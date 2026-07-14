
const http = require("http");
const fileSystem = require("fs");
const path = require("path");
const PORT = 3000;

let products = [
  { id: 1, name: "Farm Fresh Tomatoes", category: "Vegetables", price: 40, unit: "1 kg", stock: 18, image: "https://images.unsplash.com/photo-1546094096-0df4bcaaa337?auto=format&fit=crop&w=700&q=80" },
  { id: 2, name: "Bananas", category: "Fruits", price: 55, unit: "1 dozen", stock: 12, image: "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=700&q=80" },
  { id: 3, name: "Basmati Rice", category: "Staples", price: 75, unit: "1 kg", stock: 30, image: "https://images.unsplash.com/photo-1586208958839-06c17cacdf08?auto=format&fit=crop&w=700&q=80" },
  { id: 4, name: "Fresh Milk", category: "Dairy", price: 32, unit: "500 ml", stock: 20, image: "https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=700&q=80" },
  { id: 5, name: "Brown Bread", category: "Bakery", price: 45, unit: "1 pack", stock: 10, image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=700&q=80" },
  { id: 6, name: "Free Range Eggs", category: "Dairy", price: 84, unit: "6 pieces", stock: 15, image: "https://images.unsplash.com/photo-1506976785307-8732e854ad03?auto=format&fit=crop&w=700&q=80" },
  { id: 7, name: "Potatoes", category: "Vegetables", price: 35, unit: "1 kg", stock: 25, image: "https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=700&q=80" },
  { id: 8, name: "Cooking Oil", category: "Staples", price: 140, unit: "1 litre", stock: 8, image: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=700&q=80" }
];

let orders = [];

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, { "Content-Type": "application/json" });
  response.end(JSON.stringify(data));
}

function createOrder(request, response) {
  let requestBody = "";
  request.on("data", (chunk) => { requestBody += chunk; });
  request.on("end", () => {
    try {
      const orderRequest = JSON.parse(requestBody);
      const { customerName, phone, address, paymentMethod, items } = orderRequest;

      if (!customerName || !phone || !address || !paymentMethod || !Array.isArray(items) || !items.length) {
        return sendJson(response, 400, { message: "Please fill every delivery detail and add items to your cart." });
      }

      // Check stock before accepting the order.
      for (const item of items) {
        const product = products.find((product) => product.id === item.productId);
        if (!product || item.quantity < 1 || item.quantity > product.stock) {
          const name = product ? product.name : "an item";
          return sendJson(response, 400, { message: `Sorry, ${name} is not available in that quantity.` });
        }
      }

      const orderedItems = items.map((item) => {
        const product = products.find((product) => product.id === item.productId);
        product.stock -= item.quantity;
        return { name: product.name, price: product.price, quantity: item.quantity };
      });

      const subtotal = orderedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const deliveryFee = subtotal >= 499 ? 0 : 40;
      const total = subtotal + deliveryFee;
      const newOrder = {
        id: `FG-${String(orders.length + 1).padStart(4, "0")}`,
        customerName, phone, address, paymentMethod,
        items: orderedItems, subtotal, deliveryFee, total,
        status: "Confirmed",
        createdAt: new Date().toLocaleString("en-IN")
      };

      orders.unshift(newOrder);
      sendJson(response, 201, { message: "Your order has been placed successfully!", order: newOrder });
    } catch {
      sendJson(response, 400, { message: "We could not read your order details. Please try again." });
    }
  });
}

function serveWebsiteFile(urlPath, response) {
  const pagePath = urlPath === "/" ? "/index.html" : urlPath;
  const publicFolder = path.join(__dirname, "public");
  const safeFilePath = path.join(publicFolder, path.normalize(pagePath).replace(/^([.][.][/\\])+/, ""));
  const contentTypes = { ".html": "text/html", ".css": "text/css", ".js": "application/javascript" };

  if (!safeFilePath.startsWith(publicFolder)) { response.writeHead(403); return response.end("Access denied"); }
  fileSystem.readFile(safeFilePath, (error, fileContent) => {
    if (error) { response.writeHead(404); return response.end("Page not found"); }
    const extension = path.extname(safeFilePath);
    response.writeHead(200, { "Content-Type": `${contentTypes[extension] || "text/plain"}; charset=utf-8` });
    response.end(fileContent);
  });
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === "GET" && url.pathname === "/api/products") return sendJson(response, 200, products);
  if (request.method === "GET" && url.pathname === "/api/categories") {
    const categories = ["All", ...new Set(products.map((product) => product.category))];
    return sendJson(response, 200, categories);
  }
  if (request.method === "GET" && url.pathname === "/api/orders") return sendJson(response, 200, orders);
  if (request.method === "POST" && url.pathname === "/api/orders") return createOrder(request, response);

  serveWebsiteFile(url.pathname, response);
});

server.listen(PORT, () => console.log(`FreshCart is running at http://localhost:${PORT}`));
