use gitsafe::git::GitService;
use tempfile::TempDir;

#[test]
fn test_repo_id_from_url() {
    // Test standard GitHub URL
    let id = GitService::repo_id_from_url("https://github.com/example/repo1");
    assert_eq!(id, "github_com-example-repo1");

    // Test URL with .git suffix
    let id = GitService::repo_id_from_url("https://github.com/user/repo.git");
    assert_eq!(id, "github_com-user-repo");

    // Test GitLab URL
    let id = GitService::repo_id_from_url("https://gitlab.com/group/project");
    assert_eq!(id, "gitlab_com-group-project");

    // Test URL with multiple path segments
    let id = GitService::repo_id_from_url("https://github.com/org/team/repo");
    assert_eq!(id, "github_com-org-team-repo");

    // Test URL with port
    let id = GitService::repo_id_from_url("https://git.example.com:8443/user/repo");
    assert_eq!(id, "git_example_com-user-repo");
}

#[test]
fn test_repo_path_from_url() {
    // Test standard GitHub URL - compact mode (archive)
    let path = GitService::repo_path_from_url("https://github.com/example/repo1", true);
    assert_eq!(path, "github_com/example/repo1.tar.gz");

    // Test standard GitHub URL - non-compact mode (directory)
    let path = GitService::repo_path_from_url("https://github.com/example/repo1", false);
    assert_eq!(path, "github_com/example/repo1");

    // Test URL with .git suffix - compact mode
    let path = GitService::repo_path_from_url("https://github.com/user/repo.git", true);
    assert_eq!(path, "github_com/user/repo.tar.gz");

    // Test URL with .git suffix - non-compact mode
    let path = GitService::repo_path_from_url("https://github.com/user/repo.git", false);
    assert_eq!(path, "github_com/user/repo");

    // Test GitLab URL - compact mode
    let path = GitService::repo_path_from_url("https://gitlab.com/group/project", true);
    assert_eq!(path, "gitlab_com/group/project.tar.gz");

    // Test GitLab URL - non-compact mode
    let path = GitService::repo_path_from_url("https://gitlab.com/group/project", false);
    assert_eq!(path, "gitlab_com/group/project");

    // Test URL with multiple path segments - compact mode
    let path = GitService::repo_path_from_url("https://github.com/org/team/repo", true);
    assert_eq!(path, "github_com/org/team/repo.tar.gz");

    // Test URL with multiple path segments - non-compact mode
    let path = GitService::repo_path_from_url("https://github.com/org/team/repo", false);
    assert_eq!(path, "github_com/org/team/repo");

    // Test URL with port - compact mode
    let path = GitService::repo_path_from_url("https://git.example.com:8443/user/repo", true);
    assert_eq!(path, "git_example_com/user/repo.tar.gz");

    // Test URL with port - non-compact mode
    let path = GitService::repo_path_from_url("https://git.example.com:8443/user/repo", false);
    assert_eq!(path, "git_example_com/user/repo");
}

#[test]
fn test_git_service_new() {
    let temp_dir = TempDir::new().unwrap();
    let archive_path = temp_dir.path().join("archives");

    // Test compact mode
    let _service = GitService::new(&archive_path, true).unwrap();
    assert!(archive_path.exists());

    // Test non-compact mode
    let _service2 = GitService::new(&archive_path, false).unwrap();
    assert!(archive_path.exists());
}

#[test]
fn test_repo_id_special_characters() {
    // Test that special characters are handled
    let id = GitService::repo_id_from_url("https://github.com/user-name/repo_name");
    assert_eq!(id, "github_com-user-name-repo_name");

    // Test with numbers
    let id = GitService::repo_id_from_url("https://github.com/user123/repo456");
    assert_eq!(id, "github_com-user123-repo456");
}

#[test]
fn test_repo_id_edge_cases() {
    // Test empty path
    let id = GitService::repo_id_from_url("https://github.com");
    assert_eq!(id, "github_com");

    // Test trailing slash
    let id = GitService::repo_id_from_url("https://github.com/user/repo/");
    assert_eq!(id, "github_com-user-repo");
}

#[test]
fn test_repo_path_special_characters() {
    // Test that special characters are handled - compact mode
    let path = GitService::repo_path_from_url("https://github.com/user-name/repo_name", true);
    assert_eq!(path, "github_com/user-name/repo_name.tar.gz");

    // Test that special characters are handled - non-compact mode
    let path = GitService::repo_path_from_url("https://github.com/user-name/repo_name", false);
    assert_eq!(path, "github_com/user-name/repo_name");

    // Test with numbers - compact mode
    let path = GitService::repo_path_from_url("https://github.com/user123/repo456", true);
    assert_eq!(path, "github_com/user123/repo456.tar.gz");

    // Test with numbers - non-compact mode
    let path = GitService::repo_path_from_url("https://github.com/user123/repo456", false);
    assert_eq!(path, "github_com/user123/repo456");
}

#[test]
fn test_repo_path_edge_cases() {
    // Test empty path - compact mode
    let path = GitService::repo_path_from_url("https://github.com", true);
    assert_eq!(path, "github_com.tar.gz");

    // Test empty path - non-compact mode
    let path = GitService::repo_path_from_url("https://github.com", false);
    assert_eq!(path, "github_com");

    // Test trailing slash - compact mode
    let path = GitService::repo_path_from_url("https://github.com/user/repo/", true);
    assert_eq!(path, "github_com/user/repo.tar.gz");

    // Test trailing slash - non-compact mode
    let path = GitService::repo_path_from_url("https://github.com/user/repo/", false);
    assert_eq!(path, "github_com/user/repo");
}
