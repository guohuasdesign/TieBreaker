export default async function handler(req: any, res: any) {
  try {
    const { default: app } = await import("../app");
    return app(req, res);
  } catch (error: any) {
    console.error("API function initialization failed:", error);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        error: "API function initialization failed.",
        message: error?.message || String(error),
      }),
    );
  }
}
