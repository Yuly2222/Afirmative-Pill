// Todas las operaciones GraphQL del cliente. Cada pantalla pide SOLO los campos que pinta.
import { gql } from '@apollo/client';

const USER_ERROR = gql`
  fragment UserErrorFields on UserError { code message field medicationId }
`;

// Vista condensada del catálogo: 6 campos. Nada de indicaciones ni contraindicaciones.
export const MEDICATION_CARD = gql`
  fragment MedicationCard on Medication {
    id commercialName presentation price requiresPrescription stockStatus
  }
`;

export const CATALOG = gql`
  query Catalog($filter: MedicationFilter, $sort: MedicationSort, $after: String) {
    medications(filter: $filter, sort: $sort, first: 12, after: $after) {
      totalCount
      pageInfo { hasNextPage endCursor }
      nodes { ...MedicationCard }
    }
  }
  ${MEDICATION_CARD}
`;

export const CATEGORIES = gql`
  query Categories { therapeuticCategories { id name medicationCount } }
`;

// Ficha técnica: aquí sí se piden los datos clínicos y las relaciones.
export const MEDICATION_DETAIL = gql`
  query MedicationDetail($id: ID!) {
    medication(id: $id) {
      ...MedicationCard
      activeIngredient concentration availableUnits indications contraindications
      laboratory { id name country }
      category { id name }
    }
  }
  ${MEDICATION_CARD}
`;

const CART_FIELDS = gql`
  fragment CartFields on Cart {
    id status itemCount total requiresPrescription
    items {
      quantity subtotal
      medication { id commercialName presentation price requiresPrescription stockStatus }
    }
  }
`;

export const CART = gql`
  query Cart($id: ID!) { cart(id: $id) { ...CartFields } }
  ${CART_FIELDS}
`;

export const CREATE_CART = gql`
  mutation CreateCart { createCart { cart { ...CartFields } errors { ...UserErrorFields } } }
  ${CART_FIELDS} ${USER_ERROR}
`;

export const ADD_TO_CART = gql`
  mutation AddToCart($input: AddToCartInput!) {
    addToCart(input: $input) { cart { ...CartFields } errors { ...UserErrorFields } }
  }
  ${CART_FIELDS} ${USER_ERROR}
`;

export const REMOVE_FROM_CART = gql`
  mutation RemoveFromCart($input: RemoveFromCartInput!) {
    removeFromCart(input: $input) { cart { ...CartFields } errors { ...UserErrorFields } }
  }
  ${CART_FIELDS} ${USER_ERROR}
`;

export const PLACE_ORDER = gql`
  mutation PlaceOrder($input: PlaceOrderInput!) {
    placeOrder(input: $input) { orderId status acceptedAt errors { ...UserErrorFields } }
  }
  ${USER_ERROR}
`;

const ORDER_FIELDS = gql`
  fragment OrderFields on Order {
    id status total itemCount requiresPrescription cancelReason createdAt updatedAt version
    items { medicationId medicationName presentation quantity unitPrice subtotal }
    statusHistory { status at note }
  }
`;

export const ORDER = gql`
  query Order($id: ID!) { order(id: $id) { ...OrderFields } }
  ${ORDER_FIELDS}
`;

export const ORDERS = gql`
  query Orders { orders(first: 30) { ...OrderFields } }
  ${ORDER_FIELDS}
`;

export const ORDER_UPDATED = gql`
  subscription OrderUpdated($orderId: ID) { orderUpdated(orderId: $orderId) { ...OrderFields } }
  ${ORDER_FIELDS}
`;

export const REVIEW_PRESCRIPTION = gql`
  mutation ReviewPrescription($input: ReviewPrescriptionInput!) {
    reviewPrescription(input: $input) { orderId status errors { ...UserErrorFields } }
  }
  ${USER_ERROR}
`;

export const DISPATCH_ORDER = gql`
  mutation DispatchOrder($orderId: ID!) {
    dispatchOrder(orderId: $orderId) { orderId status errors { ...UserErrorFields } }
  }
  ${USER_ERROR}
`;

export const CANCEL_ORDER = gql`
  mutation CancelOrder($input: CancelOrderInput!) {
    cancelOrder(input: $input) { orderId status errors { ...UserErrorFields } }
  }
  ${USER_ERROR}
`;
