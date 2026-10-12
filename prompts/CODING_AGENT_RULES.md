# Coding agent operating rules

Inspect → plan → implement → test → validate → review → report → STOP.

Implement exactly one explicitly approved task. Preserve existing work; never overwrite blindly. Do not assume undecided auth/visibility/permissions/retention rules. Keep OpenAI keys server-side. Validate and authorize on the backend. Add tests for success and failure paths. Never claim commands ran unless they actually ran. Report exact files, commands, test results, known issues and commit SHA. Await explicit owner acceptance before starting the next task.
