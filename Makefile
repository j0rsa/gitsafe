.PHONY: build run build-api build-web test fix hooks

# Build both web and API
build: build-web build-api

# Build the API (Rust)
build-api:
	@echo "🔨 Building API..."
	cd api && cargo build --release

# Build the web frontend
build-web:
	@echo "🌐 Building web frontend..."
	cd web && bun run build

# Run the application for testing with RUST_LOG=info
# Note: This will build the API if not already built
run: build-api
	@echo "🚀 Running application with RUST_LOG=info..."
	RUST_LOG=info GITSAFE__SERVER__STATIC_DIR=api/static cargo run --release --manifest-path api/Cargo.toml

# Run all tests and checks (non-destructive)
test:
	@echo "=========================================="
	@echo "  GitSafe Code Quality Checks"
	@echo "=========================================="
	@echo ""
	@echo "📦 Checking Rust code (api/)..."
	@echo "----------------------------------------"
	@echo ""
	@echo "🧪 Running tests..."
	@cd api && cargo test --all
	@echo ""
	@echo "🔍 Checking compilation..."
	@cd api && cargo check --all
	@echo ""
	@echo "🔍 Running Clippy..."
	@cd api && cargo clippy --all -- -D warnings
	@echo ""
	@echo "🎨 Checking code formatting..."
	@cd api && cargo fmt --all -- --check
	@echo ""
	@echo "🌐 Checking Web code (web/)..."
	@echo "----------------------------------------"
	@echo ""
	@echo "🔍 Running TypeScript type check..."
	@cd web && bun run lint
	@echo ""
	@echo "🧪 Running tests..."
	@cd web && bun run test:run
	@echo ""
	@echo "=========================================="
	@echo "✅ All checks passed!"
	@echo "=========================================="

# Run checks and auto-fix issues where possible
fix:
	@echo "=========================================="
	@echo "  GitSafe Code Quality Checks (FIX MODE)"
	@echo "=========================================="
	@echo ""
	@echo "📦 Checking Rust code (api/)..."
	@echo "----------------------------------------"
	@echo ""
	@echo "🧪 Running tests..."
	@cd api && cargo test --all
	@echo ""
	@echo "🔍 Checking compilation..."
	@cd api && cargo check --all
	@echo ""
	@echo "🔍 Running Clippy (with auto-fix)..."
	@cd api && cargo clippy --all --fix --allow-dirty --allow-staged || true
	@cd api && cargo clippy --all -- -D warnings || (echo "❌ Some Clippy issues require manual fixes" && exit 1)
	@echo ""
	@echo "🎨 Auto-fixing code formatting..."
	@cd api && cargo fmt --all
	@echo ""
	@echo "🌐 Checking Web code (web/)..."
	@echo "----------------------------------------"
	@echo ""
	@echo "🔍 Running TypeScript type check..."
	@cd web && bun run lint || (echo "❌ TypeScript errors require manual fixes" && exit 1)
	@echo ""
	@echo "🧪 Running tests..."
	@cd web && bun run test:run || (echo "❌ Web tests failed" && exit 1)
	@echo ""
	@echo "=========================================="
	@echo "✅ All checks passed!"
	@echo "=========================================="

# Setup git hooks to use .githooks directory
hooks:
	@echo "Setting up git hooks for GitSafe..."
	@echo "Repository root: $(shell pwd)"
	@git config core.hooksPath .githooks
	@echo "✅ Git hooks configured successfully!"
	@echo ""
	@echo "Git will now use hooks from: $(shell pwd)/.githooks"
	@echo ""
	@echo "To verify, run: git config core.hooksPath"
	@echo "To uninstall, run: git config --unset core.hooksPath"

