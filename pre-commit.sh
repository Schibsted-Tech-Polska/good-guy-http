#!/bin/bash

RED="\033[0;31m"
NORMAL="\033[0m"

# create dir if not existent
mkdir -p .git/hooks
# Install yourself on first execution
if [ ! -f .git/hooks/pre-commit ]; then
  echo "Installing pre-commit hook..."
  ln -s ../../pre-commit.sh .git/hooks/pre-commit
fi

# Run jshint
JSHINT_DIRS="lib test"
echo -n "Running jshint..."
JSHINT_OUT=`./node_modules/jshint/bin/jshint $JSHINT_DIRS`
echo -e "done.\n"

if [ -n "$JSHINT_OUT" ]; then
  echo -e "$RED ==== There were jshint errors, stopping commit.$NORMAL"
  echo "$JSHINT_OUT"
  exit 1
fi

# Run all tests before every commit
npm test
