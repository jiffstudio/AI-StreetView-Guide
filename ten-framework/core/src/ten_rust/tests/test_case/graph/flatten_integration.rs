//
// Copyright © 2025 Agora
// This file is part of TEN Framework, an open source project.
// Licensed under the Apache License, Version 2.0, with certain conditions.
// Refer to the "LICENSE" file in the root directory for more information.
//
use ten_rust::graph::{
    connection::{
        GraphConnection, GraphDestination, GraphLoc, GraphMessageFlow,
    },
    node::{GraphContent, GraphNode, GraphNodeType},
    Graph,
};

#[cfg(test)]
mod tests {
    use std::fs;

    use tempfile::tempdir;

    use super::*;

    #[tokio::test]
    async fn test_validate_and_complete_and_flatten_with_subgraphs() {
        // Create a main graph with subgraph nodes
        let mut main_graph = Graph {
            nodes: vec![
                GraphNode::new_extension_node(
                    "ext_a".to_string(),
                    "addon_a".to_string(),
                    None,
                    None,
                    None,
                ),
                GraphNode::new_subgraph_node(
                    "subgraph_1".to_string(),
                    None,
                    GraphContent {
                        import_uri: "./test_subgraph.json".to_string(),
                    },
                ),
            ],
            connections: Some(vec![GraphConnection {
                loc: GraphLoc {
                    app: None,
                    extension: Some("ext_a".to_string()),
                    subgraph: None,
                    selector: None,
                },
                cmd: Some(vec![GraphMessageFlow::new(
                    "test_cmd".to_string(),
                    vec![GraphDestination {
                        loc: GraphLoc {
                            app: None,
                            extension: Some("subgraph_1:ext_b".to_string()),
                            subgraph: None,
                            selector: None,
                        },
                        msg_conversion: None,
                    }],
                    vec![],
                )]),
                data: None,
                audio_frame: None,
                video_frame: None,
            }]),
            exposed_messages: None,
            exposed_properties: None,
        };

        // Test with current_base_dir as None - should fail because subgraph has
        // relative path
        let result = main_graph.validate_and_complete_and_flatten(None).await;
        assert!(result.is_err());

        // Verify the error message contains information about base_dir being
        // None
        let error_msg = result.err().unwrap().to_string();
        assert!(error_msg
            .contains("base_dir cannot be None when uri is a relative path"));
    }

    #[tokio::test]
    async fn test_validate_and_complete_and_flatten_without_subgraphs() {
        // Create a graph without subgraph nodes
        let mut graph = Graph {
            nodes: vec![
                GraphNode::new_extension_node(
                    "ext_a".to_string(),
                    "addon_a".to_string(),
                    None,
                    None,
                    None,
                ),
                GraphNode::new_extension_node(
                    "ext_b".to_string(),
                    "addon_b".to_string(),
                    None,
                    None,
                    None,
                ),
            ],
            connections: Some(vec![GraphConnection {
                loc: GraphLoc {
                    app: None,
                    extension: Some("ext_a".to_string()),
                    subgraph: None,
                    selector: None,
                },
                cmd: Some(vec![GraphMessageFlow::new(
                    "test_cmd".to_string(),
                    vec![GraphDestination {
                        loc: GraphLoc {
                            app: None,
                            extension: Some("ext_b".to_string()),
                            subgraph: None,
                            selector: None,
                        },
                        msg_conversion: None,
                    }],
                    vec![],
                )]),
                data: None,
                audio_frame: None,
                video_frame: None,
            }]),
            exposed_messages: None,
            exposed_properties: None,
        };

        // Test with current_base_dir as None - should work fine since no
        // subgraphs
        let result = graph.validate_and_complete_and_flatten(None).await;
        assert!(result.is_ok());

        // The graph should remain unchanged
        assert_eq!(graph.nodes.len(), 2);
        assert!(graph
            .nodes
            .iter()
            .all(|node| node.get_type() == GraphNodeType::Extension));
    }

    #[tokio::test]
    async fn test_flatten_graph_returns_none_for_no_subgraphs() {
        // Create a graph without subgraph nodes
        let graph = Graph {
            nodes: vec![GraphNode::new_extension_node(
                "ext_a".to_string(),
                "addon_a".to_string(),
                None,
                None,
                None,
            )],
            connections: None,
            exposed_messages: None,
            exposed_properties: None,
        };

        // flatten_graph should return None since there are no subgraphs
        let result = graph.flatten_graph(None).await.unwrap();
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn test_flatten_graph_returns_some_for_subgraphs() {
        // Create a temporary directory for the subgraph
        let temp_dir = tempdir().unwrap();
        let subgraph_file_path = temp_dir.path().join("test_subgraph.json");

        // Create a graph with subgraph nodes
        let graph = Graph {
            nodes: vec![
                GraphNode::new_extension_node(
                    "ext_a".to_string(),
                    "addon_a".to_string(),
                    None,
                    None,
                    None,
                ),
                GraphNode::new_subgraph_node(
                    "subgraph_1".to_string(),
                    None,
                    GraphContent {
                        import_uri: "./test_subgraph.json".to_string(),
                    },
                ),
            ],
            connections: None,
            exposed_messages: None,
            exposed_properties: None,
        };

        // Create a simple subgraph
        let subgraph = Graph {
            nodes: vec![GraphNode::new_extension_node(
                "ext_b".to_string(),
                "addon_b".to_string(),
                None,
                None,
                None,
            )],
            connections: None,
            exposed_messages: None,
            exposed_properties: None,
        };

        // Write the subgraph to a file
        let subgraph_json = serde_json::to_string(&subgraph).unwrap();
        fs::write(subgraph_file_path, subgraph_json).unwrap();

        // flatten_graph should return Some since there are subgraphs
        let result = graph
            .flatten_graph(Some(temp_dir.path().to_str().unwrap()))
            .await
            .unwrap();
        assert!(result.is_some());

        let flattened = result.unwrap();
        assert_eq!(flattened.nodes.len(), 2); // ext_a + subgraph_1_ext_b
        assert!(flattened.nodes.iter().any(|node| node.get_name() == "ext_a"));
        assert!(flattened
            .nodes
            .iter()
            .any(|node| node.get_name() == "subgraph_1_ext_b"));
    }
}
