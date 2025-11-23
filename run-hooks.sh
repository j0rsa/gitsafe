#!/bin/bash
#
# Run-hooks script for GitSafe
# Checks code quality and auto-fixes issues where possible
#
# Usage:
#   ./run-hooks.sh          # Check only (non-destructive)
#   ./run-hooks.sh --fix    # Check and auto-fix issues
#   ./run-hooks.sh --help   # Show this help message
#

# Don't exit on error - we want to check everything and report all issues
set +e

FIX_MODE=false

# Parse arguments
if [[ "$1" == "--help" ]] || [[ "$1" == "-h" ]]; then
    echo "GitSafe Code Quality Checker"
    echo ""
    echo "Usage:"
    echo "  ./run-hooks.sh          Check code quality (non-destructive)"
    echo "  ./run-hooks.sh --fix    Check and auto-fix issues where possible"
    echo "  ./run-hooks.sh --help   Show this help message"
    echo ""
    echo "What it checks:"
    echo "  - Rust: Tests, compilation, Clippy warnings, code formatting"
    echo "  - Web: TypeScript type checking"
    echo ""
    echo "Auto-fix capabilities:"
    echo "  - Rust formatting (cargo fmt)"
    echo "  - Some Clippy warnings (cargo clippy --fix)"
    echo "  - TypeScript errors require manual fixes"
    exit 0
fi

if [[ "$1" == "--fix" ]] || [[ "$1" == "-f" ]]; then
    FIX_MODE=true
    echo "🔧 Running in FIX mode - will auto-fix issues where possible"
else
    echo "🔍 Running in CHECK mode - will only report issues"
fi

echo ""
echo "=========================================="
echo "  GitSafe Code Quality Checks"
echo "=========================================="
echo ""

# Track if any issues were found
ISSUES_FOUND=0

# Function to run Rust checks
check_rust() {
    echo ""
    echo "📦 Checking Rust code (api/)..."
    echo "----------------------------------------"
    
    cd api
    
    # Run tests
    echo ""
    echo "🧪 Running tests..."
    cargo test --all 2>&1 | tee /tmp/cargo-test.log
    TEST_EXIT=${PIPESTATUS[0]}
    if [ $TEST_EXIT -eq 0 ]; then
        echo "✅ Tests passed"
    else
        echo "❌ Tests failed"
        ISSUES_FOUND=1
        cd ..
        return 1
    fi
    
    # Check compilation
    echo ""
    echo "🔍 Checking compilation..."
    cargo check --all 2>&1 | tee /tmp/cargo-check.log
    CHECK_EXIT=${PIPESTATUS[0]}
    if [ $CHECK_EXIT -eq 0 ]; then
        echo "✅ Compilation check passed"
    else
        echo "❌ Compilation errors found"
        ISSUES_FOUND=1
        cd ..
        return 1
    fi
    
    # Clippy checks
    echo ""
    echo "🔍 Running Clippy..."
    if [ "$FIX_MODE" = true ]; then
        echo "   Attempting to auto-fix Clippy issues..."
        # Try to auto-fix, but don't fail if --fix is not available
        cargo clippy --all --fix --allow-dirty --allow-staged 2>&1 | tee /tmp/cargo-clippy.log
        CLIPPY_FIX_EXIT=${PIPESTATUS[0]}
        if [ $CLIPPY_FIX_EXIT -eq 0 ]; then
            echo "   Auto-fix applied, checking remaining issues..."
        else
            echo "   Auto-fix completed (may have fixed some issues)"
        fi
        # Always check after attempting fix
        cargo clippy --all -- -D warnings 2>&1 | tee /tmp/cargo-clippy-check.log
        CLIPPY_CHECK_EXIT=${PIPESTATUS[0]}
        if [ $CLIPPY_CHECK_EXIT -eq 0 ]; then
            echo "✅ All Clippy issues resolved"
        else
            echo "❌ Clippy issues found (some may require manual fixes)"
            ISSUES_FOUND=1
        fi
    else
        cargo clippy --all -- -D warnings 2>&1 | tee /tmp/cargo-clippy.log
        CLIPPY_EXIT=${PIPESTATUS[0]}
        if [ $CLIPPY_EXIT -eq 0 ]; then
            echo "✅ Clippy checks passed"
        else
            echo "❌ Clippy issues found"
            ISSUES_FOUND=1
        fi
    fi
    
    # Format checks
    echo ""
    echo "🎨 Checking code formatting..."
    if [ "$FIX_MODE" = true ]; then
        echo "   Auto-fixing formatting..."
        cargo fmt --all 2>&1 | tee /tmp/cargo-fmt.log
        FMT_EXIT=${PIPESTATUS[0]}
        if [ $FMT_EXIT -eq 0 ]; then
            echo "✅ Code formatted"
        else
            echo "❌ Formatting failed"
            ISSUES_FOUND=1
        fi
    else
        cargo fmt --all -- --check 2>&1 | tee /tmp/cargo-fmt-check.log
        FMT_CHECK_EXIT=${PIPESTATUS[0]}
        if [ $FMT_CHECK_EXIT -eq 0 ]; then
            echo "✅ Formatting check passed"
        else
            echo "❌ Formatting issues found (run with --fix to auto-fix)"
            ISSUES_FOUND=1
        fi
    fi
    
    cd ..
    return 0
}

# Function to run Web checks
check_web() {
    echo ""
    echo "🌐 Checking Web code (web/)..."
    echo "----------------------------------------"
    
    cd web
    
    # TypeScript type checking
    echo ""
    echo "🔍 Running TypeScript type check..."
    bun run lint 2>&1 | tee /tmp/web-lint.log
    LINT_EXIT=${PIPESTATUS[0]}
    if [ $LINT_EXIT -eq 0 ]; then
        echo "✅ TypeScript checks passed"
    else
        echo "❌ TypeScript errors found"
        echo "   Note: TypeScript errors require manual fixes"
        ISSUES_FOUND=1
        cd ..
        return 1
    fi
    
    cd ..
    return 0
}

# Run checks
RUST_OK=true
WEB_OK=true

if ! check_rust; then
    RUST_OK=false
fi

if ! check_web; then
    WEB_OK=false
fi

# Summary
echo ""
echo "=========================================="
echo "  Summary"
echo "=========================================="
echo ""

if [ "$RUST_OK" = true ]; then
    echo "✅ Rust checks: PASSED"
else
    echo "❌ Rust checks: FAILED"
fi

if [ "$WEB_OK" = true ]; then
    echo "✅ Web checks: PASSED"
else
    echo "❌ Web checks: FAILED"
fi

echo ""

if [ $ISSUES_FOUND -eq 0 ]; then
    echo "🎉 All checks passed!"
    exit 0
else
    echo "⚠️  Some issues were found"
    if [ "$FIX_MODE" = false ]; then
        echo ""
        echo "💡 Tip: Run with --fix to auto-fix some issues:"
        echo "   ./run-hooks.sh --fix"
    fi
    exit 1
fi

