//
// Copyright © 2025 Agora
// This file is part of TEN Framework, an open source project.
// Licensed under the Apache License, Version 2.0, with certain conditions.
// Refer to the "LICENSE" file in the root directory for more information.
//
use crate::graph::connection::{
    GraphDestination, GraphLoc, GraphMessageFlow, GraphSource,
};
use crate::graph::msg_conversion::MsgAndResultConversion;
use crate::graph::node::{
    AtomicFilter, Filter, FilterOperator, GraphNode, GraphNodeType,
    SelectorNode,
};
use crate::graph::Graph;
use anyhow::Result;
use regex::Regex;
use std::collections::HashMap;

#[derive(Debug)]
pub struct SelectorError {
    message: String,
    flow_name: Option<String>,
}

impl std::fmt::Display for SelectorError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        if let Some(flow) = &self.flow_name {
            write!(f, "Selector error in flow '{}': {}", flow, self.message)
        } else {
            write!(f, "Selector error: {}", self.message)
        }
    }
}

impl std::error::Error for SelectorError {}

fn has_selector_nodes(graph: &Graph) -> bool {
    graph
        .nodes
        .iter()
        .any(|node| matches!(node.get_type(), GraphNodeType::Selector))
}

fn check_flows(flows: &Option<Vec<GraphMessageFlow>>) -> bool {
    flows.iter().flat_map(|f| f.iter()).any(|flow| {
        flow.dest.iter().any(|dest| dest.loc.selector.is_some())
            || flow.source.iter().any(|source| source.loc.selector.is_some())
    })
}

fn has_connections_with_selectors(graph: &Graph) -> bool {
    graph.connections.iter().flat_map(|c| c.iter()).any(|connection| {
        check_flows(&connection.cmd)
            || check_flows(&connection.data)
            || check_flows(&connection.audio_frame)
            || check_flows(&connection.video_frame)
    })
}

fn process_message_flows_with_selector(
    flows: &mut [GraphMessageFlow],
    selector_nodes: &[(&str, &SelectorNode)],
    graph: &Graph,
    flow_type: &str,
    regex_cache: &mut HashMap<String, Regex>,
) -> Result<()> {
    for flow in flows.iter_mut() {
        let mut new_dest = Vec::new();
        let mut new_source = Vec::new();

        for dest in &flow.dest {
            if let Some(selector_name) = &dest.loc.selector {
                let matching_nodes = find_matching_nodes(
                    selector_name,
                    selector_nodes,
                    graph,
                    flow_type,
                    regex_cache,
                )?;

                if matching_nodes.is_empty() {
                    println!(
                        "Selector '{selector_name}' in flow '{flow_type}' \
                         didn't match any nodes"
                    );
                }

                // Create new destinations for each matching node
                for matched_node in matching_nodes {
                    if let Some(new_dest_loc) = create_destination_for_node(
                        matched_node,
                        dest.msg_conversion.clone(),
                    ) {
                        new_dest.push(new_dest_loc);
                    }
                }
            } else {
                // If there's no selector, keep it as is
                new_dest.push(dest.clone());
            }
        }

        for source in &flow.source {
            if let Some(selector_name) = &source.loc.selector {
                let matching_nodes = find_matching_nodes(
                    selector_name,
                    selector_nodes,
                    graph,
                    flow_type,
                    regex_cache,
                )?;

                if matching_nodes.is_empty() {
                    println!(
                        "Selector '{selector_name}' in flow '{flow_type}' \
                         didn't match any nodes"
                    );
                }

                // Create new destinations for each matching node
                for matched_node in matching_nodes {
                    if let Some(new_source_loc) =
                        create_source_for_node(matched_node)
                    {
                        new_source.push(new_source_loc);
                    }
                }
            } else {
                // If there's no selector, keep it as is
                new_source.push(source.clone());
            }
        }

        flow.dest = new_dest;
        flow.source = new_source;
    }
    Ok(())
}

fn find_matching_nodes<'a>(
    selector_name: &str,
    selector_nodes: &[(&str, &SelectorNode)],
    graph: &'a Graph,
    flow_type: &str,
    regex_cache: &mut HashMap<String, Regex>,
) -> Result<Vec<&'a GraphNode>> {
    let (_, selector_node) = selector_nodes
        .iter()
        .find(|(name, _)| *name == selector_name)
        .ok_or_else(|| SelectorError {
            message: format!("Can't find selector: {selector_name}"),
            flow_name: Some(flow_type.to_string()),
        })?;

    // Find all matching nodes
    Ok(graph
        .nodes
        .iter()
        .filter(|node| matches_filter(&selector_node.filter, node, regex_cache))
        .collect())
}

fn matches_filter(
    filter: &Filter,
    node: &GraphNode,
    regex_cache: &mut HashMap<String, Regex>,
) -> bool {
    match filter {
        Filter::Atomic(atomic) => {
            matches_atomic_filter(atomic, node, regex_cache)
        }
        Filter::And { and } => {
            and.iter().all(|f| matches_filter(f, node, regex_cache))
        }
        Filter::Or { or } => {
            or.iter().any(|f| matches_filter(f, node, regex_cache))
        }
    }
}

fn matches_atomic_filter(
    filter: &AtomicFilter,
    node: &GraphNode,
    regex_cache: &mut HashMap<String, Regex>,
) -> bool {
    let value = node.get_field(&filter.field);

    if let Some(value) = value {
        match filter.operator {
            FilterOperator::Exact => value == filter.value,
            FilterOperator::Regex => {
                match_regex(&filter.value, value, regex_cache)
            }
        }
    } else {
        false
    }
}

fn match_regex(
    pattern: &str,
    input: &str,
    regex_cache: &mut HashMap<String, Regex>,
) -> bool {
    if let Some(regex) = regex_cache.get(pattern) {
        regex.is_match(input)
    } else {
        match Regex::new(pattern) {
            Ok(regex) => {
                let result = regex.is_match(input);
                regex_cache.insert(pattern.to_string(), regex);
                result
            }
            Err(e) => {
                println!("Invalid regex pattern '{pattern}': {e}");
                false
            }
        }
    }
}

fn create_source_for_node(node: &GraphNode) -> Option<GraphSource> {
    match node {
        GraphNode::Extension { content: ext_node } => Some(GraphSource {
            loc: GraphLoc {
                app: ext_node.app.clone(),
                extension: Some(ext_node.name.clone()),
                subgraph: None,
                selector: None,
            },
        }),
        GraphNode::Subgraph { content: subgraph_node } => Some(GraphSource {
            loc: GraphLoc {
                app: None,
                extension: None,
                subgraph: Some(subgraph_node.name.clone()),
                selector: None,
            },
        }),
        _ => None,
    }
}

fn create_destination_for_node(
    node: &GraphNode,
    msg_conversion: Option<MsgAndResultConversion>,
) -> Option<GraphDestination> {
    match node {
        GraphNode::Extension { content: ext_node } => Some(GraphDestination {
            loc: GraphLoc {
                app: ext_node.app.clone(),
                extension: Some(ext_node.name.clone()),
                subgraph: None,
                selector: None,
            },
            msg_conversion,
        }),
        GraphNode::Subgraph { content: subgraph_node } => {
            Some(GraphDestination {
                loc: GraphLoc {
                    app: None,
                    extension: None,
                    subgraph: Some(subgraph_node.name.clone()),
                    selector: None,
                },
                msg_conversion,
            })
        }
        _ => None,
    }
}

impl Graph {
    pub fn flatten_selectors(&self) -> Result<Option<Graph>> {
        // Return None if there are no 'selector' nodes and no message flows
        // that use selectors.
        let has_selector_nodes = has_selector_nodes(self);
        let has_connections_with_selectors =
            has_connections_with_selectors(self);

        if !has_selector_nodes && !has_connections_with_selectors {
            return Ok(None);
        }

        let mut new_graph = self.clone();

        // Only collect selector nodes if we need them
        let selector_nodes: Vec<(&str, &SelectorNode)> = self
            .nodes
            .iter()
            .filter_map(|node| {
                node.as_selector_node()
                    .map(|selector_node| (node.get_name(), selector_node))
            })
            .collect();

        // Create regex cache
        let mut regex_cache: HashMap<String, Regex> = HashMap::new();

        if let Some(connections) = &mut new_graph.connections {
            for connection in connections.iter_mut() {
                for (flow_type, flows) in [
                    ("cmd", &mut connection.cmd),
                    ("data", &mut connection.data),
                    ("audio_frame", &mut connection.audio_frame),
                    ("video_frame", &mut connection.video_frame),
                ] {
                    if let Some(flows) = flows {
                        process_message_flows_with_selector(
                            flows,
                            &selector_nodes,
                            self,
                            flow_type,
                            &mut regex_cache,
                        )?;
                    }
                }
            }
        }

        // Remove all selector nodes
        new_graph
            .nodes
            .retain(|node| !matches!(node.get_type(), GraphNodeType::Selector));

        Ok(Some(new_graph))
    }
}
