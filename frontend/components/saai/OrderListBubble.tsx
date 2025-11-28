import React from 'react';

interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
}

interface Order {
  orderId: string;
  status: string;
  createdAt: string;
  items: OrderItem[];
  summary: {
    totalItems: number;
    totalAmount: number;
  };
}

interface OrderListBubbleProps {
  orders: Order[];
  onCancelOrder?: (orderId: string) => void;
}

function getStatusColor(status: string) {
  if (status === 'DELIVERED') return 'bg-green-500/20 text-green-400';
  if (status === 'CANCELLED') return 'bg-red-500/20 text-red-400';
  return 'bg-blue-500/20 text-blue-400';
}

export default function OrderListBubble({ orders, onCancelOrder }: Readonly<OrderListBubbleProps>) {
  if (!orders || orders.length === 0) {
    return (
      <div className="p-4 bg-[#252525] rounded-lg border border-white/10">
        <p className="text-white/60">No orders found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 w-full max-w-md">
      {orders.map((order) => (
        <div key={order.orderId} className="bg-[#252525] rounded-xl border border-white/10 overflow-hidden">
          {/* Order Header */}
          <div className="px-4 py-3 bg-white/5 border-b border-white/10 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-white/90">Order #{order.orderId}</p>
              <p className="text-xs text-white/50">{new Date(order.createdAt).toLocaleDateString()}</p>
            </div>
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(order.status)}`}>
              {order.status}
            </span>
          </div>

          {/* Order Items */}
          <div className="p-4 space-y-3">
            {order.items.map((item) => (
              <div key={item.productId} className="flex justify-between text-sm">
                <span className="text-white/70">
                  {item.quantity}x {item.name}
                </span>
                <span className="text-white/90 font-medium">
                  ₹{item.subtotal}
                </span>
              </div>
            ))}
            
            <div className="pt-3 mt-3 border-t border-white/10 flex justify-between items-center">
              <span className="text-sm font-medium text-white/90">Total</span>
              <span className="text-base font-bold text-white">₹{order.summary.totalAmount}</span>
            </div>
          </div>

          {/* Actions */}
          {['PROCESSING', 'CONFIRMED'].includes(order.status) && onCancelOrder && (
            <div className="px-4 py-3 bg-white/5 border-t border-white/10">
              <button
                onClick={() => onCancelOrder(order.orderId)}
                className="w-full py-2 px-4 bg-transparent border border-red-500/50 text-red-400 text-sm font-medium rounded-lg hover:bg-red-500/10 transition-colors"
              >
                Cancel Order
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
