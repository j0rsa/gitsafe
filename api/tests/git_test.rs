use gitsafe::git::GitService;
use tempfile::TempDir;

#[test]
fn test_repo_name_from_url() {
    // Test standard GitHub URL
    let name = GitService::repo_name_from_url("https://github.com/example/repo1");
    assert_eq!(name, "github_com-example-repo1");

    // Test URL with .git suffix
    let name = GitService::repo_name_from_url("https://github.com/user/repo.git");
    assert_eq!(name, "github_com-user-repo");

    // Test GitLab URL
    let name = GitService::repo_name_from_url("https://gitlab.com/group/project");
    assert_eq!(name, "gitlab_com-group-project");

    // Test URL with multiple path segments
    let name = GitService::repo_name_from_url("https://github.com/org/team/repo");
    assert_eq!(name, "github_com-org-team-repo");

    // Test URL with port
    let name = GitService::repo_name_from_url("https://git.example.com:8443/user/repo");
    assert_eq!(name, "git_example_com-user-repo");
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
fn test_repo_name_special_characters() {
    // Test that special characters are handled
    let name = GitService::repo_name_from_url("https://github.com/user-name/repo_name");
    assert_eq!(name, "github_com-user-name-repo_name");

    // Test with numbers
    let name = GitService::repo_name_from_url("https://github.com/user123/repo456");
    assert_eq!(name, "github_com-user123-repo456");
}

#[test]
fn test_repo_name_edge_cases() {
    // Test empty path
    let name = GitService::repo_name_from_url("https://github.com");
    assert_eq!(name, "github_com");

    // Test trailing slash
    let name = GitService::repo_name_from_url("https://github.com/user/repo/");
    assert_eq!(name, "github_com-user-repo");
}
