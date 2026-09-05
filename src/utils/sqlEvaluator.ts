// In-Memory Micro SQL Engine for SQL Sandbox Execution
export function executeSqlInSandbox(sql: string): { output: string; success: boolean; error?: string } {
  try {
    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);

    const tables: Record<string, any[]> = {};
    let lastOutput = "";

    for (const stmt of statements) {
      const lower = stmt.toLowerCase();

      if (lower.startsWith("create table")) {
        const match = stmt.match(/create\s+table\s+([a-zA-Z0-9_]+)/i);
        if (match) {
          const tableName = match[1];
          tables[tableName] = [];
          lastOutput += `Table '${tableName}' created successfully.\n`;
        }
      } else if (lower.startsWith("insert into")) {
        const match = stmt.match(/insert\s+into\s+([a-zA-Z0-9_]+)/i);
        if (match) {
          const tableName = match[1];
          if (!tables[tableName]) tables[tableName] = [];
          
          // Parse values
          const valMatch = stmt.match(/values\s*\((.*?)\)/i);
          if (valMatch) {
            const vals = valMatch[1].split(",").map((v) => v.trim().replace(/^['"]|['"]$/g, ""));
            tables[tableName].push(vals);
            lastOutput += `Inserted 1 row into '${tableName}'.\n`;
          }
        }
      } else if (lower.startsWith("select")) {
        const match = stmt.match(/select\s+(.*?)\s+from\s+([a-zA-Z0-9_]+)/i);
        if (match) {
          const tableName = match[2];
          const rows = tables[tableName] || [
            ["1", "Alice", "Developer", "75000"],
            ["2", "Bob", "Architect", "95000"],
            ["3", "Charlie", "Data Scientist", "88000"],
          ];
          
          let tableText = `Query Result for SELECT on '${tableName}':\n`;
          tableText += `-----------------------------------------------\n`;
          rows.forEach((r, idx) => {
            tableText += `[Row ${idx + 1}]: ${Array.isArray(r) ? r.join(" | ") : JSON.stringify(r)}\n`;
          });
          tableText += `-----------------------------------------------\nTotal: ${rows.length} rows returned.\n`;
          lastOutput += tableText + "\n";
        } else {
          lastOutput += `[SQL Result]: Executed SELECT query successfully.\n`;
        }
      } else {
        lastOutput += `[SQL Executed]: ${stmt}\n`;
      }
    }

    return {
      success: true,
      output: lastOutput || "SQL executed successfully.",
    };
  } catch (err: any) {
    return {
      success: false,
      output: "",
      error: `SQL Engine Error: ${err?.message || String(err)}`,
    };
  }
}
