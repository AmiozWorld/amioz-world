// ====================================================================
// 1. GLOBAL VARIABLES & INITIALIZATION
// ====================================================================

// Initialize the shopping cart array by loading from local storage, 
// or starting as an empty array if nothing is stored yet.
let shoppingCart = JSON.parse(localStorage.getItem('shoppingCart')) || [];

// Define shipping cost (in Rupees)
const SHIPPING_COST = 50.00;

// NOTE: You will need to replace 'rzp_test_...' with your actual test key
const RAZORPAY_KEY = 'rzp_test_rYq68244K8jR'; // *** IMPORTANT: KEEP THIS GENERIC KEY FOR TESTING ***

// ====================================================================
// 2. CORE UTILITY FUNCTIONS (Save, Load, Update Count)
// ====================================================================

/**
 * Saves the current state of the shoppingCart array to the browser's local storage.
 */
function saveCart() {
    localStorage.setItem('shoppingCart', JSON.stringify(shoppingCart));
}

/**
 * Updates the small cart count number visible in the header navigation.
 */
function updateCartCount() {
    const cartCountElement = document.getElementById('cart-count');
    if (cartCountElement) {
        // Calculate the total number of items (sum of all quantities)
        const totalItems = shoppingCart.reduce((total, item) => total + item.quantity, 0);
        cartCountElement.textContent = totalItems;
    }
}

// ====================================================================
// 3. ADD TO CART FUNCTION (Called from products.html buttons)
// ====================================================================

/**
 * Adds a product to the shopping cart or increments its quantity.
 * @param {string} id - The unique ID of the product.
 * @param {string} name - The name of the product.
 * @param {number} price - The price of the product.
 */
function addToCart(id, name, price) {
    const existingItem = shoppingCart.find(item => item.id === id);

    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        shoppingCart.push({
            id: id,
            name: name,
            price: price,
            quantity: 1
        });
    }

    saveCart();
    updateCartCount();

    // Redirect the user immediately to the checkout page after adding
    window.location.href = 'checkout.html';
}

// ====================================================================
// 4. CHECKOUT PAGE FUNCTIONS (Render, Update Totals, Change Quantity)
// ====================================================================

// NEW GLOBAL VARIABLE to hold the calculated final total in Rupees
let grandTotal = 0; 

/**
 * Renders the cart items and summary on the checkout.html page.
 */
function renderCartItems() {
    const container = document.getElementById('cart-items-container');
    const checkoutButton = document.getElementById('checkout-button');
    
    // Check if the container exists and the cart is empty
    if (!container) return; 

    if (shoppingCart.length === 0) {
        container.innerHTML = '<div class="empty-cart-message">Your cart is empty. <a href="products.html">Start shopping!</a></div>';
        if (checkoutButton) checkoutButton.disabled = true;
        updateCartTotals();
        return;
    }

    // Generate HTML for each item
    container.innerHTML = shoppingCart.map(item => `
        <div class="cart-item" data-id="${item.id}" style="display: flex; justify-content: space-between; align-items: center; padding: 15px 0;">
            <span class="item-name" style="flex: 2;">${item.name}</span>
            <span class="item-price" style="flex: 1; text-align: right;">₹${(item.price * item.quantity).toFixed(2)}</span>
            <div class="item-controls" style="display: flex; align-items: center; margin-left: 20px;">
                <button 
                    onclick="changeQuantity('${item.id}', -1)"
                    style="background-color: #a1887f; color: white; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer; height: 35px;"
                >-</button>
                <span class="quantity-display" style="padding: 0 10px; border: 1px solid #ccc; border-radius: 5px; height: 35px; line-height: 35px; display: inline-block; min-width: 20px; text-align: center;">
                    ${item.quantity}
                </span>
                <button 
                    onclick="changeQuantity('${item.id}', 1)"
                    style="background-color: #6d4c41; color: white; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer; height: 35px;"
                >+</button>
                <button 
                    onclick="removeItem('${item.id}')"
                    style="background-color: #e57373; color: white; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer; margin-left: 10px; height: 35px;"
                >Remove</button>
            </div>
        </div>
    `).join('');

    updateCartTotals();
    if (checkoutButton) checkoutButton.disabled = false;
}

/**
 * Recalculates and displays the subtotal, shipping, and grand total.
 * Also updates the global 'grandTotal' variable.
 */
function updateCartTotals() {
    const subtotalElement = document.getElementById('cart-subtotal');
    const shippingElement = document.getElementById('cart-shipping');
    const totalElement = document.getElementById('cart-total');

    if (!subtotalElement) return;

    // Calculate subtotal
    let subtotal = shoppingCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // Determine shipping cost (free if subtotal is over 1000, otherwise fixed)
    let shipping = subtotal > 1000 ? 0.00 : (subtotal > 0 ? SHIPPING_COST : 0.00);
    grandTotal = subtotal + shipping; // *** CRITICAL: Update the global variable ***

    // Update the HTML elements
    subtotalElement.textContent = `₹${subtotal.toFixed(2)}`;
    shippingElement.textContent = `₹${shipping.toFixed(2)}`;
    totalElement.textContent = `₹${grandTotal.toFixed(2)}`;
}


/**
 * Changes the quantity of a product by a specific amount (+1 or -1).
 * @param {string} id - The unique ID of the product.
 * @param {number} delta - The change in quantity (-1 for minus, 1 for plus).
 */
function changeQuantity(id, delta) {
    const item = shoppingCart.find(p => p.id === id);

    if (item) {
        item.quantity += delta;

        if (item.quantity < 1) {
            removeItem(id);
        } else {
            saveCart();
            renderCartItems(); // Re-render to update the display and totals
        }
    }
}

/**
 * Removes an entire product from the shopping cart.
 * @param {string} id - The unique ID of the product to remove.
 */
function removeItem(id) {
    shoppingCart = shoppingCart.filter(item => item.id !== id);
    saveCart();
    renderCartItems(); 
    updateCartCount();
}

// ====================================================================
// 5. PAYMENT INTEGRATION (Razorpay)
// ====================================================================

/**
 * Initiates the Razorpay payment process.
 * Called directly by the checkout button's onclick attribute.
 */
function payNow() {
    // 1. **CRITICAL FIX**: Re-calculate totals immediately before payment
    updateCartTotals(); 

    // 2. Check for empty cart/zero amount
    if (grandTotal <= 0) {
        alert("Your cart is empty or the total is zero. Cannot proceed to payment.");
        return; 
    }

    // 3. Convert total to Paisa (Razorpay uses Paisa)
    const amountInPaisa = Math.round(grandTotal * 100);

    const options = {
        key: RAZORPAY_KEY, 
        amount: amountInPaisa, // Amount is in currency subunits (Paisa)
        currency: "INR",
        name: "AMIO'Z WORLD",
        description: "Payment for Footwear Order",
        image: "https://your-logo-url.com/logo.png", 
        handler: function (response) {
            // This function runs ONLY on confirmed successful payment
            alert("Payment successful! Payment ID: " + response.razorpay_payment_id);
            
            // 4. CLEAR CART AND REDIRECT
            shoppingCart = [];
            saveCart(); // Saves the empty cart to local storage
            updateCartCount(); // Updates the header count
            
            window.location.href = 'index.html'; 
        },
        prefill: {
            name: "Test Customer",
            email: "customer@example.com",
            contact: "9999999999"
        },
        theme: {
            color: "#6d4c41" 
        }
    };

    const rzp = new Razorpay(options);
    rzp.open(); // Open the payment modal
}

// ====================================================================
// 6. INITIALIZATION & EVENT LISTENERS
// ====================================================================

// Ensure the code runs after the entire HTML document is loaded
document.addEventListener('DOMContentLoaded', () => {
    updateCartCount();
    
    // Check if the user is on the checkout page
    if (document.getElementById('cart-items-container')) {
        renderCartItems();
    }
    
    // NOTE: We are NOT using 'checkoutButton.addEventListener('click', payNow);'
    // because the button already has onclick="payNow()" in the HTML.
});