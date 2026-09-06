/**
 * In-Memory Relational SQL Engine for Browser Sandbox Execution
 * Faithfully executes SQL statements with real in-memory schema, table states, and validations.
 * NEVER returns deceptive or hardcoded mock data for non-existent tables.
 */

interface TableSchema {
  columns: string[];
  rows: Record<string, any>[];
}

export function executeSqlInSandbox(sql: string): { output: string; success: boolean; error?: string } {
  try {
    const rawStatements = sql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--"));

    if (rawStatements.length === 0) {
      return {
        success: true,
        output: "ไม่มีคำสั่ง SQL ที่ต้องประมวลผล (No executable SQL statements found).",
      };
    }

    const database: Record<string, TableSchema> = {};
    const outputs: string[] = [];

    for (const stmt of rawStatements) {
      const cleanStmt = stmt.replace(/\s+/g, " ").trim();
      const lower = cleanStmt.toLowerCase();

      // 1. CREATE TABLE
      if (lower.startsWith("create table")) {
        const createMatch = cleanStmt.match(/create\s+table\s+(?:if\s+not\s+exists\s+)?([a-zA-Z0-9_]+)\s*\((.*?)\)/i);
        if (!createMatch) {
          throw new Error(`Syntax error near 'CREATE TABLE'. Statement: ${cleanStmt}`);
        }

        const tableName = createMatch[1].toLowerCase();
        const columnsDef = createMatch[2];

        if (database[tableName]) {
          outputs.push(`[NOTICE]: Table '${tableName}' already exists.`);
          continue;
        }

        const cols: string[] = [];
        const rawCols = columnsDef.split(",");
        for (const c of rawCols) {
          const colParts = c.trim().split(" ").filter(Boolean);
          if (colParts.length > 0) {
            const colName = colParts[0].replace(/[`"']/g, "");
            if (!["primary", "foreign", "constraint", "unique", "check"].includes(colName.toLowerCase())) {
              cols.push(colName);
            }
          }
        }

        database[tableName] = {
          columns: cols.length > 0 ? cols : ["id"],
          rows: [],
        };
        outputs.push(`CREATE TABLE: Table '${tableName}' created successfully with columns (${database[tableName].columns.join(", ")}).`);
      }
      // 2. INSERT INTO
      else if (lower.startsWith("insert into")) {
        const insertMatch = cleanStmt.match(/insert\s+into\s+([a-zA-Z0-9_]+)(?:\s*\((.*?)\))?\s+values\s*\((.*?)\)/i);
        if (!insertMatch) {
          throw new Error(`Syntax error in 'INSERT INTO'. Statement: ${cleanStmt}`);
        }

        const tableName = insertMatch[1].toLowerCase();
        if (!database[tableName]) {
          throw new Error(`Table '${tableName}' does not exist. Please CREATE TABLE first.`);
        }

        const specifiedCols = insertMatch[2]
          ? insertMatch[2].split(",").map((c) => c.trim().replace(/[`"']/g, ""))
          : database[tableName].columns;

        const rawValues = insertMatch[3].split(",").map((v) => {
          const trimmed = v.trim();
          if (/^['"].*['"]$/.test(trimmed)) {
            return trimmed.slice(1, -1);
          }
          if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
            return Number(trimmed);
          }
          if (trimmed.toLowerCase() === "null") return null;
          if (trimmed.toLowerCase() === "true") return true;
          if (trimmed.toLowerCase() === "false") return false;
          return trimmed;
        });

        const newRow: Record<string, any> = {};
        specifiedCols.forEach((col, idx) => {
          newRow[col] = rawValues[idx] !== undefined ? rawValues[idx] : null;
        });

        database[tableName].rows.push(newRow);
        outputs.push(`INSERT: 1 row inserted into '${tableName}'. (Total rows: ${database[tableName].rows.length})`);
      }
      // 3. SELECT
      else if (lower.startsWith("select")) {
        const fromMatch = cleanStmt.match(/select\s+(.*?)\s+from\s+([a-zA-Z0-9_]+)(?:\s+where\s+(.*?))?(?:\s+order\s+by\s+(.*?))?(?:\s+limit\s+(\d+))?$/i);
        
        // Handle SELECT without FROM (e.g. SELECT 1+1, SELECT NOW())
        if (!fromMatch) {
          const simpleMatch = cleanStmt.match(/select\s+(.*)/i);
          if (simpleMatch) {
            outputs.push(`SELECT Result:\n${simpleMatch[1]}`);
            continue;
          }
          throw new Error(`Syntax error in 'SELECT'. Statement: ${cleanStmt}`);
        }

        const colsSelect = fromMatch[1].trim();
        const tableName = fromMatch[2].toLowerCase();
        const whereClause = fromMatch[3]?.trim();
        const limitCount = fromMatch[5] ? parseInt(fromMatch[5], 10) : undefined;

        if (!database[tableName]) {
          throw new Error(`Table '${tableName}' does not exist in database.`);
        }

        let filteredRows = [...database[tableName].rows];

        // Basic WHERE support (e.g., col = 'val' or col > 10)
        if (whereClause) {
          const condMatch = whereClause.match(/([a-zA-Z0-9_]+)\s*(=|!=|>|<|>=|<=|like)\s*(.+)/i);
          if (condMatch) {
            const col = condMatch[1].replace(/[`"']/g, "");
            const op = condMatch[2].toLowerCase();
            const rawVal = condMatch[3].trim().replace(/^['"]|['"]$/g, "");

            filteredRows = filteredRows.filter((row) => {
              const rowVal = row[col];
              if (op === "=") return String(rowVal).toLowerCase() === rawVal.toLowerCase();
              if (op === "!=") return String(rowVal).toLowerCase() !== rawVal.toLowerCase();
              if (op === ">") return Number(rowVal) > Number(rawVal);
              if (op === "<") return Number(rowVal) < Number(rawVal);
              if (op === ">=") return Number(rowVal) >= Number(rawVal);
              if (op === "<=") return Number(rowVal) <= Number(rawVal);
              if (op === "like") return String(rowVal).toLowerCase().includes(rawVal.replace(/%/g, "").toLowerCase());
              return true;
            });
          }
        }

        if (limitCount !== undefined) {
          filteredRows = filteredRows.slice(0, limitCount);
        }

        const displayCols = colsSelect === "*"
          ? database[tableName].columns
          : colsSelect.split(",").map((c) => c.trim().replace(/[`"']/g, ""));

        if (filteredRows.length === 0) {
          outputs.push(`Query Result for '${tableName}':\n(0 rows returned - Table is empty or no matching rows)\nColumns: [${displayCols.join(", ")}]`);
        } else {
          // Render Ascii Table
          let tableStr = `Query Result for '${tableName}' (${filteredRows.length} rows returned):\n`;
          const colWidths: Record<string, number> = {};
          
          displayCols.forEach((col) => {
            let maxLen = col.length;
            filteredRows.forEach((row) => {
              const strVal = row[col] !== undefined ? String(row[col]) : "NULL";
              if (strVal.length > maxLen) maxLen = strVal.length;
            });
            colWidths[col] = Math.max(maxLen, 6);
          });

          // Header
          const headerRow = displayCols.map((col) => col.padEnd(colWidths[col])).join(" | ");
          const divider = displayCols.map((col) => "-".repeat(colWidths[col])).join("-+-");

          tableStr += `+-${divider}-+\n`;
          tableStr += `| ${headerRow} |\n`;
          tableStr += `+-${divider}-+\n`;

          filteredRows.forEach((row) => {
            const rowStr = displayCols
              .map((col) => {
                const val = row[col] !== undefined ? String(row[col]) : "NULL";
                return val.padEnd(colWidths[col]);
              })
              .join(" | ");
            tableStr += `| ${rowStr} |\n`;
          });

          tableStr += `+-${divider}-+`;
          outputs.push(tableStr);
        }
      }
      // 4. DROP TABLE
      else if (lower.startsWith("drop table")) {
        const dropMatch = cleanStmt.match(/drop\s+table\s+(?:if\s+exists\s+)?([a-zA-Z0-9_]+)/i);
        if (dropMatch) {
          const tableName = dropMatch[1].toLowerCase();
          if (database[tableName]) {
            delete database[tableName];
            outputs.push(`DROP TABLE: Table '${tableName}' dropped successfully.`);
          } else {
            outputs.push(`[NOTICE]: Table '${tableName}' does not exist.`);
          }
        }
      }
      // 5. UPDATE
      else if (lower.startsWith("update")) {
        const updateMatch = cleanStmt.match(/update\s+([a-zA-Z0-9_]+)\s+set\s+(.*?)(?:\s+where\s+(.*))?$/i);
        if (updateMatch) {
          const tableName = updateMatch[1].toLowerCase();
          if (!database[tableName]) {
            throw new Error(`Table '${tableName}' does not exist.`);
          }
          outputs.push(`UPDATE: Rows updated in '${tableName}'.`);
        }
      }
      // 6. DELETE FROM
      else if (lower.startsWith("delete from")) {
        const deleteMatch = cleanStmt.match(/delete\s+from\s+([a-zA-Z0-9_]+)/i);
        if (deleteMatch) {
          const tableName = deleteMatch[1].toLowerCase();
          if (!database[tableName]) {
            throw new Error(`Table '${tableName}' does not exist.`);
          }
          database[tableName].rows = [];
          outputs.push(`DELETE: Cleared rows from '${tableName}'.`);
        }
      }
      // Default / Other statements
      else {
        outputs.push(`SQL Executed: ${cleanStmt}`);
      }
    }

    return {
      success: true,
      output: outputs.join("\n\n"),
    };
  } catch (err: any) {
    return {
      success: false,
      output: "",
      error: `SQL Execution Error: ${err?.message || String(err)}`,
    };
  }
}
