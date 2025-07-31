//
// Copyright © 2025 Agora
// This file is part of TEN Framework, an open source project.
// Licensed under the Apache License, Version 2.0, with certain conditions.
// Refer to the "LICENSE" file in the root directory for more information.
//
#[cfg(test)]
mod tests {
    use ten_rust::utils::path::get_real_path_from_import_uri;

    #[test]
    fn test_get_real_path_absolute_path() {
        // Test with Unix-style absolute path
        #[cfg(unix)]
        {
            let import_uri = "/home/user/interface.json";
            let base_dir = "/home/user";
            let real_path =
                get_real_path_from_import_uri(import_uri, Some(base_dir));

            assert!(real_path.is_err());
            assert!(real_path
                .err()
                .unwrap()
                .to_string()
                .contains("Absolute paths are not supported in import_uri"));
        }
    }

    #[test]
    fn test_get_real_path_http_url() {
        let import_uri = "http://example.com/api/interface.json";
        let base_dir = "/some/path";
        let real_path =
            get_real_path_from_import_uri(import_uri, Some(base_dir));

        assert!(real_path.is_ok());
        assert_eq!(real_path.unwrap(), "http://example.com/api/interface.json");
    }

    #[test]
    fn test_get_real_path_https_url() {
        let import_uri = "https://example.com/api/interface.json";
        let base_dir = "/some/path";
        let real_path =
            get_real_path_from_import_uri(import_uri, Some(base_dir));

        assert!(real_path.is_ok());
        assert_eq!(
            real_path.unwrap(),
            "https://example.com/api/interface.json"
        );
    }

    #[test]
    fn test_get_real_path_file_url() {
        let import_uri = "file:///home/user/interface.json";
        let base_dir = "/some/path";
        let real_path =
            get_real_path_from_import_uri(import_uri, Some(base_dir));

        assert!(real_path.is_ok());
        assert_eq!(real_path.unwrap(), "file:///home/user/interface.json");
    }

    #[test]
    fn test_get_real_path_unsupported_url_scheme() {
        let import_uri = "ftp://example.com/interface.json";
        let base_dir = "/some/path";
        let real_path =
            get_real_path_from_import_uri(import_uri, Some(base_dir));

        assert!(real_path.is_err());
        assert!(real_path
            .err()
            .unwrap()
            .to_string()
            .contains("Unsupported URL scheme 'ftp'"));
    }

    #[test]
    fn test_get_real_path_relative_path_empty_base_dir() {
        let import_uri = "interface.json";
        let base_dir = "";
        let real_path =
            get_real_path_from_import_uri(import_uri, Some(base_dir));

        assert!(real_path.is_err());
        assert!(real_path
            .err()
            .unwrap()
            .to_string()
            .contains("base_dir cannot be None when uri is a relative path"));
    }

    #[test]
    fn test_get_real_path_relative_path_with_http_base_dir() {
        let import_uri = "interface.json";
        let base_dir = "http://example.com/api/v1";
        let real_path =
            get_real_path_from_import_uri(import_uri, Some(base_dir));

        assert!(real_path.is_ok());
        assert_eq!(
            real_path.unwrap(),
            "http://example.com/api/v1/interface.json"
        );
    }

    #[test]
    fn test_get_real_path_relative_path_with_https_base_dir() {
        let import_uri = "interface.json";
        let base_dir = "https://example.com/api/v1";
        let real_path =
            get_real_path_from_import_uri(import_uri, Some(base_dir));

        assert!(real_path.is_ok());
        assert_eq!(
            real_path.unwrap(),
            "https://example.com/api/v1/interface.json"
        );
    }

    #[test]
    fn test_get_real_path_relative_path_with_https_base_dir2() {
        let import_uri = "./interface.json";
        let base_dir = "https://example.com/api/v1";
        let real_path =
            get_real_path_from_import_uri(import_uri, Some(base_dir));

        assert!(real_path.is_ok());
        assert_eq!(
            real_path.unwrap(),
            "https://example.com/api/v1/interface.json"
        );
    }

    #[test]
    fn test_get_real_path_relative_path_with_https_base_dir_and_relative_path()
    {
        let import_uri = "../interface.json";
        let base_dir = "https://example.com/api/v1";
        let real_path =
            get_real_path_from_import_uri(import_uri, Some(base_dir));

        assert!(real_path.is_ok());
        assert_eq!(
            real_path.unwrap(),
            "https://example.com/api/interface.json"
        );
    }

    #[test]
    fn test_get_real_path_relative_path_with_file_base_dir() {
        let import_uri = "../interface.json";
        let base_dir = "file:///home/user/tmp";
        let real_path =
            get_real_path_from_import_uri(import_uri, Some(base_dir));

        assert!(real_path.is_ok());
        assert_eq!(real_path.unwrap(), "file:///home/user/interface.json");
    }

    #[test]
    fn test_get_real_path_relative_path_with_local_base_dir() {
        let import_uri = "interface.json";
        let base_dir = "/home/user";
        let real_path =
            get_real_path_from_import_uri(import_uri, Some(base_dir));

        assert!(real_path.is_ok());
        let result = real_path.unwrap();

        // On Windows, the path might be normalized differently
        // Just check that it ends with the expected filename and contains the
        // base components
        assert!(result.contains("interface.json"));
        assert!(result.contains("home") || result.contains("user"));

        // For Unix-like systems, check the exact path
        #[cfg(unix)]
        assert_eq!(result, "/home/user/interface.json");
    }

    #[test]
    fn test_get_real_path_relative_path_with_subdirectory() {
        let import_uri = "subdir/interface.json";
        let base_dir = "/home/user";
        let real_path =
            get_real_path_from_import_uri(import_uri, Some(base_dir));

        assert!(real_path.is_ok());
        let result = real_path.unwrap();

        // Check that the path contains the expected components
        assert!(result.contains("interface.json"));
        assert!(result.contains("subdir"));
        assert!(result.contains("home") || result.contains("user"));

        // For Unix-like systems, check the exact path
        #[cfg(unix)]
        assert_eq!(result, "/home/user/subdir/interface.json");
    }

    #[test]
    fn test_get_real_path_relative_path_with_parent_directory() {
        let import_uri = "../interface.json";
        let base_dir = "/home/user/project";
        let real_path =
            get_real_path_from_import_uri(import_uri, Some(base_dir));

        assert!(real_path.is_ok());
        let result = real_path.unwrap();

        // Check that the path contains the expected components
        assert!(result.contains("interface.json"));
        assert!(result.contains("home") || result.contains("user"));
        // Should not contain "project" since we went up one level

        // For Unix-like systems, check the exact path
        #[cfg(unix)]
        assert_eq!(result, "/home/user/interface.json");
    }

    #[test]
    fn test_get_real_path_windows_absolute_path() {
        // Test with Windows-style absolute path on all platforms
        #[cfg(windows)]
        {
            let import_uri_win = "C:\\Users\\test\\interface.json";
            let base_dir_win = "C:\\Users\\test";
            let real_path_win = get_real_path_from_import_uri(
                import_uri_win,
                Some(base_dir_win),
            );

            assert!(real_path_win.is_err());
            assert!(real_path_win
                .err()
                .unwrap()
                .to_string()
                .contains("Absolute paths are not supported in import_uri"));
        }
    }

    #[test]
    fn test_get_real_path_complex_relative_path() {
        let import_uri = "./subdir/../interface.json";
        let base_dir = "/home/user/project";
        let real_path =
            get_real_path_from_import_uri(import_uri, Some(base_dir));

        assert!(real_path.is_ok());
        let result = real_path.unwrap();

        // Check that the path contains the expected components
        assert!(result.contains("interface.json"));
        assert!(result.contains("project"));
        assert!(result.contains("home") || result.contains("user"));

        // For Unix-like systems, check the exact path
        #[cfg(unix)]
        assert_eq!(result, "/home/user/project/interface.json");
    }

    #[test]
    fn test_get_real_path_url_with_query_params() {
        let import_uri = "https://example.com/api/interface.json?version=1.0";
        let base_dir = "/some/path";
        let real_path =
            get_real_path_from_import_uri(import_uri, Some(base_dir));

        assert!(real_path.is_ok());
        assert_eq!(
            real_path.unwrap(),
            "https://example.com/api/interface.json?version=1.0"
        );
    }

    #[test]
    fn test_get_real_path_url_with_fragment() {
        let import_uri = "https://example.com/api/interface.json#section1";
        let base_dir = "/some/path";
        let real_path =
            get_real_path_from_import_uri(import_uri, Some(base_dir));

        assert!(real_path.is_ok());
        assert_eq!(
            real_path.unwrap(),
            "https://example.com/api/interface.json#section1"
        );
    }

    #[test]
    fn test_get_real_path_relative_with_windows_base_dir() {
        let import_uri = "interface.json";
        let base_dir = "C:\\Users\\test";
        let real_path =
            get_real_path_from_import_uri(import_uri, Some(base_dir));

        assert!(real_path.is_ok());
        // On Windows, this would be C:\Users\test\interface.json
        // On Unix-like systems, it would be C:\Users\test/interface.json
        assert!(real_path.unwrap().contains("interface.json"));
    }
}
