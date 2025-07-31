//
// Copyright © 2025 Agora
// This file is part of TEN Framework, an open source project.
// Licensed under the Apache License, Version 2.0, with certain conditions.
// Refer to the "LICENSE" file in the root directory for more information.
//
use anyhow::Result;
use serde::{Deserialize, Serialize};

use crate::constants::ERR_MSG_GRAPH_LOCALHOST_FORBIDDEN_IN_MULTI_APP_MODE;
use crate::constants::ERR_MSG_GRAPH_LOCALHOST_FORBIDDEN_IN_SINGLE_APP_MODE;
use crate::graph::AppUriDeclarationState;

use crate::graph::is_app_default_loc_or_none;
use crate::pkg_info::localhost;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum GraphNodeType {
    Extension,
    Subgraph,
    Selector,
}

/// Represents an extension node in the graph
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ExtensionNode {
    pub name: String,
    pub addon: String,

    /// The extension group this node belongs to. Extension group nodes
    /// themselves do not contain this field, as they define groups rather
    /// than belong to them.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub extension_group: Option<String>,

    #[serde(skip_serializing_if = "is_app_default_loc_or_none")]
    pub app: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub property: Option<serde_json::Value>,
}

/// Represents a subgraph node in the graph
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SubgraphNode {
    pub name: String,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub property: Option<serde_json::Value>,

    pub graph: GraphContent,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct GraphContent {
    pub import_uri: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum FilterOperator {
    #[serde(rename = "exact")]
    Exact,
    #[serde(rename = "regex")]
    Regex,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AtomicFilter {
    pub field: String,
    pub operator: FilterOperator,
    pub value: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(untagged)]
pub enum Filter {
    Atomic(AtomicFilter),
    And { and: Vec<Filter> },
    Or { or: Vec<Filter> },
}

impl Filter {
    pub fn as_atomic_filter(&self) -> Option<&AtomicFilter> {
        match self {
            Filter::Atomic(atomic) => Some(atomic),
            _ => None,
        }
    }

    pub fn as_and_filter(&self) -> Option<&[Filter]> {
        match self {
            Filter::And { and } => Some(and),
            _ => None,
        }
    }

    pub fn as_or_filter(&self) -> Option<&[Filter]> {
        match self {
            Filter::Or { or } => Some(or),
            _ => None,
        }
    }
}

/// Represents a subgraph node in the graph
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SelectorNode {
    pub name: String,

    pub filter: Filter,
}

/// Represents a node in a graph. This enum represents different types of nodes
/// that can exist in the graph.
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum GraphNode {
    Extension {
        #[serde(flatten)]
        content: ExtensionNode,
    },
    Subgraph {
        #[serde(flatten)]
        content: SubgraphNode,
    },
    Selector {
        #[serde(flatten)]
        content: SelectorNode,
    },
}

impl GraphNode {
    pub fn new_extension_node(
        name: String,
        addon: String,
        extension_group: Option<String>,
        app: Option<String>,
        property: Option<serde_json::Value>,
    ) -> Self {
        Self::Extension {
            content: ExtensionNode {
                name,
                addon,
                extension_group,
                app,
                property,
            },
        }
    }

    pub fn new_subgraph_node(
        name: String,
        property: Option<serde_json::Value>,
        graph: GraphContent,
    ) -> Self {
        Self::Subgraph { content: SubgraphNode { name, property, graph } }
    }

    /// Validates and completes a graph node by ensuring it has all required
    /// fields and follows the app declaration rules of the graph.
    ///
    /// For graphs spanning multiple apps, no node can have 'localhost' as its
    /// app field value, as other apps would not know how to connect to the
    /// app that node belongs to. For consistency, single app graphs also do
    /// not allow 'localhost' as an explicit app field value. Instead,
    /// 'localhost' is used as the internal default value when no app field is
    /// specified.
    pub fn validate_and_complete(
        &mut self,
        app_uri_declaration_state: &AppUriDeclarationState,
    ) -> Result<()> {
        match self {
            GraphNode::Extension { content } => {
                // Validate app URI if provided
                if let Some(app) = &content.app {
                    // Disallow 'localhost' as an app URI in graph definitions.
                    if app.as_str() == localhost() {
                        let err_msg = if app_uri_declaration_state
                            .is_single_app_graph()
                        {
                            ERR_MSG_GRAPH_LOCALHOST_FORBIDDEN_IN_SINGLE_APP_MODE
                        } else {
                            ERR_MSG_GRAPH_LOCALHOST_FORBIDDEN_IN_MULTI_APP_MODE
                        };
                        return Err(anyhow::anyhow!(err_msg));
                    }
                }
                Ok(())
            }
            GraphNode::Subgraph { .. } => Ok(()),
            GraphNode::Selector { .. } => Ok(()),
        }
    }

    pub fn get_app_uri(&self) -> &Option<String> {
        match self {
            GraphNode::Extension { content } => &content.app,
            GraphNode::Subgraph { .. } => &None,
            GraphNode::Selector { .. } => &None,
        }
    }

    pub fn get_type(&self) -> GraphNodeType {
        match self {
            GraphNode::Extension { .. } => GraphNodeType::Extension,
            GraphNode::Subgraph { .. } => GraphNodeType::Subgraph,
            GraphNode::Selector { .. } => GraphNodeType::Selector,
        }
    }

    pub fn get_name(&self) -> &str {
        match self {
            GraphNode::Extension { content } => &content.name,
            GraphNode::Subgraph { content } => &content.name,
            GraphNode::Selector { content } => &content.name,
        }
    }

    pub fn set_name(&mut self, name: String) {
        match self {
            GraphNode::Extension { content } => content.name = name,
            GraphNode::Subgraph { content } => content.name = name,
            GraphNode::Selector { content } => content.name = name,
        }
    }

    pub fn get_field(&self, field: &str) -> Option<&str> {
        match self {
            GraphNode::Extension { content } => match field {
                "name" => Some(&content.name),
                "type" => Some("extension"),
                "app" => content.app.as_deref(),
                "addon" => Some(&content.addon),
                _ => None,
            },
            GraphNode::Subgraph { content } => match field {
                "name" => Some(&content.name),
                "type" => Some("subgraph"),
                _ => None,
            },
            GraphNode::Selector { content } => match field {
                "name" => Some(&content.name),
                "type" => Some("selector"),
                _ => None,
            },
        }
    }

    pub fn as_selector_node(&self) -> Option<&SelectorNode> {
        match self {
            GraphNode::Selector { content } => Some(content),
            _ => None,
        }
    }

    pub fn as_extension_node(&self) -> Option<&ExtensionNode> {
        match self {
            GraphNode::Extension { content } => Some(content),
            _ => None,
        }
    }

    pub fn as_subgraph_node(&self) -> Option<&SubgraphNode> {
        match self {
            GraphNode::Subgraph { content } => Some(content),
            _ => None,
        }
    }
}
