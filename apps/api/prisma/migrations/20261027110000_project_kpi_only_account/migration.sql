WITH accounts AS (
  SELECT project_id, channel, source_account_id AS account_id
  FROM campaign
  WHERE source_account_id IS NOT NULL
  UNION
  SELECT project_id, provider::channel, account_id
  FROM project_integration
),
only_account AS (
  SELECT project_id, MIN(channel::text)::channel AS channel, MIN(account_id) AS account_id
  FROM accounts
  GROUP BY project_id
  HAVING COUNT(*) = 1
)
UPDATE project_kpi
SET channel = only_account.channel, source_account_id = only_account.account_id
FROM only_account
WHERE project_kpi.project_id = only_account.project_id
  AND project_kpi.channel IS NULL
  AND project_kpi.source_account_id IS NULL;
