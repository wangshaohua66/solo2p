package com.freshcommunity.controller;

import com.freshcommunity.common.Result;
import com.freshcommunity.entity.Cart;
import com.freshcommunity.service.CartService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/cart")
public class CartController {

    @Autowired
    private CartService cartService;

    @GetMapping("/user/{userId}")
    public Result<List<Cart>> getCartByUser(@PathVariable Long userId) {
        List<Cart> list = cartService.getCartByUser(userId);
        return Result.success(list);
    }

    @PostMapping("/add")
    public Result<Void> addToCart(@RequestBody Cart cart) {
        boolean success = cartService.addToCart(cart.getUserId(), cart.getProductId(), cart.getCommunityId(), cart.getQuantity());
        return success ? Result.success() : Result.error("加入购物车失败，库存不足或商品不可用");
    }

    @PutMapping("/{cartId}/quantity/{quantity}")
    public Result<Void> updateCartQuantity(@PathVariable Long cartId, @PathVariable Integer quantity) {
        boolean success = cartService.updateCartQuantity(cartId, quantity);
        return success ? Result.success() : Result.error("更新失败");
    }

    @DeleteMapping("/{cartId}")
    public Result<Void> removeFromCart(@PathVariable Long cartId) {
        boolean success = cartService.removeFromCart(cartId);
        return success ? Result.success() : Result.error("删除失败");
    }

    @DeleteMapping("/clear/{userId}")
    public Result<Void> clearCart(@PathVariable Long userId) {
        boolean success = cartService.clearCart(userId);
        return success ? Result.success() : Result.error("清空购物车失败");
    }
}
