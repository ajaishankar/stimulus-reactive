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

  connect() {
    const subtotal = this.computed(() =>
      this.cartItemOutlets.reduce(
        (total, item) => total + item.priceValue * item.quantityValue,
        0
      )
    );

    const tax = this.computed(() => (subtotal.value * this.taxRateValue) / 100);

    const shipping = this.computed(() =>
      subtotal.value ? this.shippingValue : 0
    );

    const total = this.computed(
      () => subtotal.value + tax.value + shipping.value
    );

    this.effect(() => {
      this.subtotalTarget.textContent = subtotal.value.toFixed(2);
      this.shippingTarget.textContent = shipping.value.toFixed(2);
      this.taxTarget.textContent = tax.value.toFixed(2);
      this.totalTarget.textContent = total.value.toFixed(2);
    });

    this.effect(() => {
      this.checkoutTarget.disabled = total.value <= 0;
      if (total.value > 0) {
        this.noItemsMessageTarget.classList.add("hidden");
      } else {
        this.noItemsMessageTarget.classList.remove("hidden");
      }
    });
  }
}
