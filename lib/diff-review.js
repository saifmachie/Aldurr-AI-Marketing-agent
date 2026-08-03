// Parses the human-edited full-batch review markdown (output/quarter-<id>.md)
// back into structured posts, so the orchestrator can diff it against the
// machine-generated baseline and log amendments per §6 of the architecture
// spec. Posts are keyed by date, not day — day names repeat ~13x per quarter.
function parseReview(markdown) {
  const chunks = markdown.split(/\n---\n/);
  const posts = [];
  for (const chunk of chunks) {
    const dateMatch = chunk.match(/^## (\d{4}-\d{2}-\d{2}) — (\S+) — (.+)$/m);
    if (!dateMatch) continue;

    const hookMatch = chunk.match(/\*\*Hook:\*\* (.+)/);
    const copyMatch = chunk.match(/\*\*Copy:\*\*\n([\s\S]*?)\n\*\*CTA:\*\*/);
    const ctaMatch = chunk.match(/\*\*CTA:\*\* (.+)/);

    posts.push({
      date: dateMatch[1],
      day: dateMatch[2],
      title: dateMatch[3].trim(),
      hook: hookMatch ? hookMatch[1].trim() : '',
      copy: copyMatch ? copyMatch[1].trim() : '',
      cta: ctaMatch ? ctaMatch[1].trim() : '',
    });
  }
  return posts;
}

function diffPosts(baseline, edited) {
  const diffs = [];
  const fields = ['hook', 'copy', 'cta'];
  for (const basePost of baseline) {
    const editedPost = edited.find((p) => p.date === basePost.date);
    if (!editedPost) continue;
    for (const field of fields) {
      if (basePost[field] !== editedPost[field]) {
        diffs.push({ post: basePost.date, field, before: basePost[field], after: editedPost[field] });
      }
    }
  }
  return diffs;
}

module.exports = { parseReview, diffPosts };
