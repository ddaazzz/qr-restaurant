import app from "./app";
import path from "path";
import express from "express";

app.use(
  "/qrs",
  express.static(path.join(__dirname, "..", "qrs"))
);
/*const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
*/
const PORT = 3000;

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
