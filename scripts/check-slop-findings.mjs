let input = "";

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  input += chunk;
});

process.stdin.on("end", () => {
  const parsed = JSON.parse(input);
  const findingCount = parsed.summary?.findingCount ?? 0;

  if (findingCount > 0) {
    console.error(`slop-scan found ${findingCount} finding${findingCount === 1 ? "" : "s"}.`);
    process.exit(1);
  }
});
