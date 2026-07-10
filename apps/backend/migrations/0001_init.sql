-- Conversations are stored as one JSON blob per row (the whole node tree),
-- not normalized into per-node rows: the frontend already owns the tree
-- shape and just needs a durable place to save/load snapshots keyed by
-- conversation id and scoped to a user. Keeping the backend schema-agnostic
-- about node structure means the two apps don't have to share a types
-- package or stay in lockstep when the tree shape evolves.
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'New chat',
  data TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_conversations_user_updated ON conversations (user_id, updated_at DESC);
