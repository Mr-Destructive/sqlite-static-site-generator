# The challenges of soft delete

**Link:** https://atlas9.dev/blog/soft-delete.html

## Context

Nice read. I had experienced it in my first internship. This problem of dead objects. Especially if you are using Django and Postgres. It looked easy to add a field of soft deletion. But the resulting queries could create bottlenecks. Since then I haven’t quite gotten the chance to explore this, this article showed me the different ways to implement the soft deletion.

**Source:** techstructive-weekly-78
