// Resolvers delgados: Query → read/, Mutation → write/, campos anidados → DataLoaders.
import { withFilter } from 'graphql-subscriptions';
import { DateTime, Money, PositiveInt } from './scalars.js';
import * as read from './read/queries.js';
import * as write from './write/commands.js';
import { pubsub, ORDER_UPDATED } from './read/projector.js';
import { toIntId } from './db.js';

const LOW_STOCK_THRESHOLD = 10;
const cartItems = (cart, _, { loaders }) => loaders.cartItemsByCart.load(cart.id);

export const resolvers = {
  DateTime,
  Money,
  PositiveInt,

  Query: {
    async medications(_, args, { loaders }) {
      const page = await read.searchMedications(args);
      // Precargar el loader: si la misma operación pide luego estos ids, no hay otra consulta.
      for (const m of page.nodes) loaders.medicationById.prime(m.id, m);
      return page;
    },
    medication: (_, { id }, { loaders }) => (toIntId(id) ? loaders.medicationById.load(id) : null),
    therapeuticCategories: () => read.listCategories(),
    cart: (_, { id }) => read.getCart(id),
    order: (_, { id }) => read.getOrder(id),
    orders: (_, args) => read.listOrders(args),
  },

  Mutation: {
    createCart: () => write.createCart(),
    addToCart: (_, { input }) => write.addToCart(input),
    removeFromCart: (_, { input }) => write.removeFromCart(input),
    placeOrder: (_, { input }) => write.placeOrder(input),
    reviewPrescription: (_, { input }) => write.reviewPrescription(input),
    dispatchOrder: (_, args) => write.dispatchOrder(args),
    cancelOrder: (_, { input }) => write.cancelOrder(input),
  },

  Subscription: {
    orderUpdated: {
      subscribe: withFilter(
        () => pubsub.asyncIterableIterator(ORDER_UPDATED),
        (payload, { orderId }) => !orderId || payload.orderUpdated.id === orderId,
      ),
    },
  },

  Medication: {
    stockStatus: ({ stock }) => (stock === 0 ? 'OUT_OF_STOCK' : stock <= LOW_STOCK_THRESHOLD ? 'LOW_STOCK' : 'IN_STOCK'),
    availableUnits: ({ stock }) => stock,
    laboratory: (m, _, { loaders }) => loaders.laboratoryById.load(m.laboratoryId),
    category: (m, _, { loaders }) => loaders.categoryById.load(m.categoryId),
  },

  TherapeuticCategory: {
    medications: async (c, { first }, { loaders }) => (await loaders.medicationsByCategory.load(c.id)).slice(0, first),
    medicationCount: async (c, _, { loaders }) => (await loaders.medicationsByCategory.load(c.id)).length,
  },

  Cart: {
    items: cartItems,
    itemCount: async (...args) => (await cartItems(...args)).reduce((n, it) => n + it.quantity, 0),
    total: async (...args) => (await cartItems(...args)).reduce((sum, it) => sum + it.price * it.quantity, 0),
    requiresPrescription: async (...args) => (await cartItems(...args)).some((it) => it.requiresPrescription),
  },

  CartItem: {
    medication: (it, _, { loaders }) => loaders.medicationById.load(it.medicationId),
    subtotal: (it) => it.price * it.quantity,
  },

  OrderItem: {
    subtotal: (it) => it.unitPrice * it.quantity,
    medication: (it, _, { loaders }) => loaders.medicationById.load(it.medicationId),
  },
};
