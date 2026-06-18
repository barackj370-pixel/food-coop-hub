async function run() {
    try {
        const response = await fetch("http://localhost:3000/api/gemini", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: "Hello", model: "gemini-2.5-flash" })
        });
        console.log("Status:", response.status);
        const text = await response.text();
        console.log("Raw body:", text);
        console.log("Parsed:", JSON.parse(text));
    } catch (e) {
        console.error("Fetch Error:", e);
    }
}
run();
