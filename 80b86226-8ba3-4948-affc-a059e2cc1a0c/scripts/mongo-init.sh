#!/bin/bash
set -e

echo "Creating MongoDB users for each tenant DB (template)..."

mongosh -u admin -p carbon!Mongo2024 <<'EOF'
  // 保证主节点
  const status = rs.status();
  print("ReplicaSet: " + status.set + " myState=" + status.myState);
EOF

echo "MongoDB init done."
