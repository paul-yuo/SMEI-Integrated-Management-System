import http from "http";

http.get("http://127.0.0.1:3000/templates/PIS_TEMPLATE.xlsx", (res) => {
  console.log("Status Code:", res.statusCode);
  console.log("Headers:", res.headers);
  const chunks = [];
  res.on("data", (chunk) => chunks.push(chunk));
  res.on("end", () => {
    const buffer = Buffer.concat(chunks);
    console.log("Byte length:", buffer.length);
    console.log("First 50 bytes:", buffer.slice(0, 50).toString("utf-8"));
  });
}).on("error", (err) => {
  console.error("Error: ", err.message);
});
