#!/bin/bash
#
# Setup script for GitSafe git hooks
# Configures git to use hooks from .githooks directory
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "Setting up git hooks for GitSafe..."
echo "Repository root: $REPO_ROOT"

# Configure git to use .githooks directory
cd "$REPO_ROOT"
git config core.hooksPath .githooks

echo "✅ Git hooks configured successfully!"
echo ""
echo "Git will now use hooks from: $REPO_ROOT/.githooks"
echo ""
echo "To verify, run: git config core.hooksPath"
echo "To uninstall, run: git config --unset core.hooksPath"

