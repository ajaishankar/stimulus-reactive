/* eslint-disable no-undef */
import CartController from "./cart-controller.js";
import CartItemController from "./cart-item-controller.js";
import { Application } from "./lib/stimulus.js";

window.Stimulus = Application.start();
Stimulus.register("cart", CartController);
Stimulus.register("cart-item", CartItemController);
