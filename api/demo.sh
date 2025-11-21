#!/bin/bash
# Demo script for GitSafe API

set -e

HOST="http://127.0.0.1:8080"

echo "=== GitSafe API Demo ==="
echo

# Health check
echo "1. Health Check"
curl -s $HOST/health | jq .
echo
echo

# Login
echo "2. Login (username: admin, password: admin)"
TOKEN=$(curl -s -X POST $HOST/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' | jq -r .token)

if [ "$TOKEN" = "null" ]; then
  echo "Failed to login. Make sure the server is running and has the default admin user."
  exit 1
fi

echo "Token received: ${TOKEN:0:20}..."
echo
echo

# Add credential
echo "3. Add Git credential"
CRED_ID=$(curl -s -X POST $HOST/api/credentials \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "git",
    "password": "your-password",
    "ssh_key": null
  }' | jq -r .id)

echo "Credential created with ID: $CRED_ID"
echo
echo

# List credentials
echo "4. List all credentials"
curl -s -X GET $HOST/api/credentials \
  -H "Authorization: Bearer $TOKEN" | jq .
echo
echo

# Add repository
echo "5. Add a public repository"
REPO_ID=$(curl -s -X POST $HOST/api/repositories \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://github.com/octocat/Hello-World.git",
    "credential_id": null
  }' | jq -r .id)

echo "Repository added with ID: $REPO_ID"
echo
echo

# List repositories
echo "6. List all repositories"
curl -s -X GET $HOST/api/repositories \
  -H "Authorization: Bearer $TOKEN" | jq .
echo
echo

# Manual sync (optional - uncomment to test)
# echo "7. Manually sync the repository"
# curl -s -X POST $HOST/api/sync \
#   -H "Authorization: Bearer $TOKEN" \
#   -H "Content-Type: application/json" \
#   -d "{\"repository_id\":\"$REPO_ID\"}" | jq .
# echo
# echo

echo "=== Demo Complete ==="
echo
echo "To clean up, you can delete the repository and credential:"
echo "curl -X DELETE $HOST/api/repositories/$REPO_ID -H \"Authorization: Bearer $TOKEN\""
echo "curl -X DELETE $HOST/api/credentials/$CRED_ID -H \"Authorization: Bearer $TOKEN\""
