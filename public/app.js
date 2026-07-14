// FreshCart browser code. Each function has one simple job.

const appState = {
  products: [],
  cart: JSON.parse(localStorage.getItem("freshcart-cart") || "[]"),
  selectedCategory: "All"
};

// A small shortcut for selecting an element from the page.
function getElement(selector) {
  return document.querySelector(selector);
}

function formatRupees(amount) {
  return `Rs. ${amount.toLocaleString("en-IN")}`;
}

async function getProducts() {
  const response = await fetch("/api/products");
  appState.products = await response.json();
  showProducts();
}

async function getCategories() {
  const response = await fetch("/api/categories");
  const categories = await response.json();

  getElement("#categories").innerHTML = categories.map((category) => {
    const isSelected = category === appState.selectedCategory ? "active" : "";
    return `<button class="category-button ${isSelected}" data-category="${category}">${category}</button>`;
  }).join("");
}

function showProducts() {
  const searchText = getElement("#searchInput").value.toLowerCase();
  const matchingProducts = appState.products.filter((product) => {
    const correctCategory = appState.selectedCategory === "All" || product.category === appState.selectedCategory;
    const matchesSearch = product.name.toLowerCase().includes(searchText);
    return correctCategory && matchesSearch;
  });

  if (!matchingProducts.length) {
    getElement("#productGrid").innerHTML = "<p>No groceries found. Try another search.</p>";
    return;
  }

  getElement("#productGrid").innerHTML = matchingProducts.map((product) => {
    const buttonText = product.stock ? "Add to cart" : "Out of stock";
    const disabled = product.stock ? "" : "disabled";
    return `
      <article class="product-card">
        <div class="product-image"><img src="${product.image}" alt="${product.name}" loading="lazy"></div>
        <div class="product-info">
          <span class="category">${product.category}</span>
          <h3>${product.name}</h3>
          <p class="unit">${product.unit}</p>
          <div class="product-bottom">
            <strong>${formatRupees(product.price)}</strong>
            <button class="add" data-product-id="${product.id}" ${disabled}>${buttonText}</button>
          </div>
          <small class="stock">${product.stock} available</small>
        </div>
      </article>`;
  }).join("");
}

function addProductToCart(productId) {
  const product = appState.products.find((item) => item.id === productId);
  const cartItem = appState.cart.find((item) => item.productId === productId);

  if (cartItem) {
    if (cartItem.quantity < product.stock) cartItem.quantity += 1;
  } else {
    appState.cart.push({ productId, quantity: 1 });
  }
  saveAndShowCart();
}

function changeCartQuantity(productId, amountToChange) {
  const cartItem = appState.cart.find((item) => item.productId === productId);
  const product = appState.products.find((item) => item.id === productId);
  if (!cartItem || !product) return;

  cartItem.quantity += amountToChange;
  if (cartItem.quantity <= 0) {
    appState.cart = appState.cart.filter((item) => item.productId !== productId);
  } else if (cartItem.quantity > product.stock) {
    cartItem.quantity = product.stock;
  }
  saveAndShowCart();
}

function saveAndShowCart() {
  localStorage.setItem("freshcart-cart", JSON.stringify(appState.cart));
  showCart();
}

function showCart() {
  const cartWithProducts = appState.cart.map((cartItem) => ({
    ...cartItem,
    product: appState.products.find((product) => product.id === cartItem.productId)
  })).filter((item) => item.product);

  const itemCount = cartWithProducts.reduce((total, item) => total + item.quantity, 0);
  const subtotal = cartWithProducts.reduce((total, item) => total + item.product.price * item.quantity, 0);
  const deliveryFee = subtotal >= 499 || subtotal === 0 ? 0 : 40;
  const cartTotal = subtotal + deliveryFee;
  getElement("#cartCount").textContent = itemCount;
  getElement("#cartTotal").textContent = formatRupees(cartTotal);
  getElement("#checkoutButton").disabled = itemCount === 0;

  getElement("#cartItems").innerHTML = cartWithProducts.length
    ? cartWithProducts.map((item) => `
      <div class="cart-item">
        <img src="${item.product.image}" alt="${item.product.name}">
        <div><strong>${item.product.name}</strong><small>${formatRupees(item.product.price)} x ${item.quantity}</small></div>
        <div class="quantity">
          <button data-change="-1" data-product-id="${item.productId}">-</button><b>${item.quantity}</b>
          <button data-change="1" data-product-id="${item.productId}">+</button>
        </div>
      </div>`).join("")
    : "<p class='empty'>Your cart is empty. Add something fresh!</p>";

  const deliveryMessage = subtotal >= 499 ? "You unlocked free delivery!" : `Add ${formatRupees(499 - subtotal)} more for free delivery.`;
  getElement("#deliveryMessage").textContent = deliveryMessage;
  getElement("#deliveryFee").textContent = deliveryFee ? formatRupees(deliveryFee) : "Free";
}

function openCart() { getElement("#cartPanel").classList.add("show"); getElement("#overlay").classList.add("show"); }
function closeCart() { getElement("#cartPanel").classList.remove("show"); getElement("#overlay").classList.remove("show"); }

document.addEventListener("click", (event) => {
  const productId = Number(event.target.dataset.productId);
  if (event.target.matches(".add")) addProductToCart(productId);
  if (event.target.matches("[data-change]")) changeCartQuantity(productId, Number(event.target.dataset.change));
  if (event.target.matches("[data-category]")) { appState.selectedCategory = event.target.dataset.category; getCategories(); showProducts(); }
});

getElement("#searchInput").addEventListener("input", showProducts);
getElement("#openCart").onclick = openCart;
getElement("#closeCart").onclick = closeCart;
getElement("#overlay").onclick = closeCart;
getElement("#shopNow").onclick = () => getElement("#catalog").scrollIntoView({ behavior: "smooth" });
getElement("#checkoutButton").onclick = () => getElement("#checkoutDialog").showModal();
getElement("#closeCheckout").onclick = () => getElement("#checkoutDialog").close();

getElement("#checkoutForm").onsubmit = async (event) => {
  event.preventDefault();
  const orderDetails = Object.fromEntries(new FormData(event.target));
  orderDetails.items = appState.cart;
  const response = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(orderDetails) });
  const result = await response.json();
  getElement("#formMessage").textContent = result.message;
  if (response.ok) { appState.cart = []; saveAndShowCart(); event.target.reset(); setTimeout(() => { getElement("#checkoutDialog").close(); closeCart(); getProducts(); }, 1300); }
};

Promise.all([getProducts(), getCategories()]).then(showCart);
