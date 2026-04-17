import { app } from "./app.js";
import { config } from "./lib/config.js";

app.listen(config.port, "0.0.0.0", () => {
  console.log(`Pigeon Post is listening on port ${config.port}`);
});
