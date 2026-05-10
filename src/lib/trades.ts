export type DeliveryMethod = "presencial" | "correio" | "outro";

export const deliveryMethodLabels: Record<DeliveryMethod, string> = {
  presencial: "Troca presencial",
  correio: "Correio",
  outro: "Outro",
};
