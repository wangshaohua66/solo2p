package com.freshcommunity.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.freshcommunity.entity.Cart;
import com.freshcommunity.entity.Product;
import com.freshcommunity.entity.ProductCommunityStock;
import com.freshcommunity.mapper.CartMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class CartService extends ServiceImpl<CartMapper, Cart> {

    @Autowired
    private ProductService productService;

    @Autowired
    private ProductCommunityStockService stockService;

    public List<Cart> getCartByUser(Long userId) {
        return list(new LambdaQueryWrapper<Cart>().eq(Cart::getUserId, userId));
    }

    public boolean addToCart(Long userId, Long productId, Long communityId, Integer quantity) {
        Product product = productService.getById(productId);
        if (product == null || product.getStatus() != 1) {
            return false;
        }
        ProductCommunityStock stock = stockService.getStock(productId, communityId);
        if (stock == null || stock.getStock() < quantity) {
            return false;
        }
        Cart existing = getOne(new LambdaQueryWrapper<Cart>()
                .eq(Cart::getUserId, userId)
                .eq(Cart::getProductId, productId)
                .eq(Cart::getCommunityId, communityId));
        if (existing != null) {
            existing.setQuantity(existing.getQuantity() + quantity);
            return updateById(existing);
        }
        Cart cart = new Cart();
        cart.setUserId(userId);
        cart.setProductId(productId);
        cart.setCommunityId(communityId);
        cart.setQuantity(quantity);
        return save(cart);
    }

    public boolean updateCartQuantity(Long cartId, Integer quantity) {
        Cart cart = getById(cartId);
        if (cart == null) {
            return false;
        }
        cart.setQuantity(quantity);
        return updateById(cart);
    }

    public boolean removeFromCart(Long cartId) {
        return removeById(cartId);
    }

    public boolean clearCart(Long userId) {
        return remove(new LambdaQueryWrapper<Cart>().eq(Cart::getUserId, userId));
    }
}
