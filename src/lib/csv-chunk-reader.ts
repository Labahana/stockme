/**
 * Streaming CSV reader — yields fixed-size row chunks so large Stocky
 * exports (100k–200k+ rows) never sit fully in memory as one JSON body.
 */
export class CSVChunkReader {
  constructor(private chunkSize = 10_000) {}

  async *readChunks(file: File): AsyncGenerator<{
    chunkIndex: number;
    headers: string[];
    rows: Record<string, string>[];
    progress: number;
    rowsInFile: number;
  }> {
    const text = await file.text();
    const lines = this.splitLines(text);
    if (lines.length === 0) return;

    const headers = this.parseLine(lines[0]).map((h) => h.trim());
    const totalRows = Math.max(lines.length - 1, 1);
    let chunkIndex = 0;
    let currentChunk: Record<string, string>[] = [];
    let dataRowsSeen = 0;

    for (let i = 1; i < lines.length; i++) {
      const cells = this.parseLine(lines[i]);
      if (cells.every((c) => c.trim() === "")) continue;

      const record: Record<string, string> = {};
      headers.forEach((h, idx) => {
        record[h] = (cells[idx] ?? "").trim();
      });
      currentChunk.push(record);
      dataRowsSeen++;

      if (currentChunk.length >= this.chunkSize || i === lines.length - 1) {
        yield {
          chunkIndex,
          headers,
          rows: currentChunk,
          progress: Math.round((i / totalRows) * 100),
          rowsInFile: dataRowsSeen,
        };
        chunkIndex++;
        currentChunk = [];
      }
    }
  }

  private splitLines(text: string): string[] {
    const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    return normalized.split("\n").filter((line, idx, arr) => {
      // keep blank interior lines for parse fidelity; drop trailing empty
      if (idx === arr.length - 1 && line === "") return false;
      return true;
    });
  }

  private parseLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (inQuotes) {
        if (char === '"') {
          if (line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          current += char;
        }
      } else if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }
}
