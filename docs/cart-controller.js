import { useStimulusReactive } from "./lib/stimulus-reactive.js";
import { Controller } from "./lib/stimulus.js";

export default class extends Controller {
  static values = {
    shipping: Number,
    taxRate: Number,
  };

  static targets = [
    "checkout",
    "subtotal",
    "shipping",
    "tax",
    "total",
    "noItemsMessage",
  ];
  static outlets = ["cart-item"];

  static afterLoad(identifier, application) {
    useStimulusReactive(identifier, application);
  }

  get subtotal() {
    return this.cartItemOutlets.reduce((total, item) => total + item.total, 0);
  }

  get tax() {
    return (this.subtotal * this.taxRateValue) / 100;
  }

  get shipping() {
    return this.subtotal ? this.shippingValue : 0;
  }

  get total() {
    return this.subtotal + this.tax + this.shipping;
  }

  connect() {
    this.effect(() => {
      this.subtotalTarget.textContent = this.subtotal.toFixed(2);
      this.shippingTarget.textContent = this.shipping.toFixed(2);
      this.taxTarget.textContent = this.tax.toFixed(2);
      this.totalTarget.textContent = this.total.toFixed(2);

      this.checkoutTarget.disabled = this.total == 0;

      if (this.total > 0) {
        this.noItemsMessageTarget.classList.add("hidden");
      } else {
        this.noItemsMessageTarget.classList.remove("hidden");
      }
    });
  }
}
