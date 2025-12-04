import { Server } from 'socket.io';
import { AuthenticatedSocket } from '../auth';

export function handlePriceUpdates(_socket: AuthenticatedSocket, _io: Server) {
  // This will be used when price update routes emit events
  // For now, it's a placeholder for future implementation
}

// Helper function to broadcast price updates
export function broadcastPriceUpdate(
  io: Server,
  data: {
    productId: string;
    productName: string;
    priceType: 'default' | 'private';
    newPrice: number;
    currency: string;
    companyId?: string; // For private prices
    supplierId: string;
  }
) {
  // For default prices: broadcast to all companies
  if (data.priceType === 'default') {
    // Get all company tenants and broadcast to them
    io.to('companies').emit('price:updated', {
      event: 'price:updated',
      data: {
        productId: data.productId,
        productName: data.productName,
        priceType: 'default',
        newPrice: data.newPrice,
        currency: data.currency,
        supplierId: data.supplierId,
        updatedAt: new Date().toISOString(),
      },
    });
  }

  // For private prices: broadcast only to specific company
  if (data.priceType === 'private' && data.companyId) {
    io.to(`tenant:${data.companyId}`).emit('price:updated', {
      event: 'price:updated',
      data: {
        productId: data.productId,
        productName: data.productName,
        priceType: 'private',
        newPrice: data.newPrice,
        currency: data.currency,
        supplierId: data.supplierId,
        updatedAt: new Date().toISOString(),
      },
    });
  }

  // Also notify the supplier
  io.to(`tenant:${data.supplierId}`).emit('price:updated', {
    event: 'price:updated',
    data: {
      productId: data.productId,
      productName: data.productName,
      priceType: data.priceType,
      newPrice: data.newPrice,
      currency: data.currency,
      updatedAt: new Date().toISOString(),
    },
  });
}

