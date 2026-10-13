const paymentDataChangedEvent = "workforce:payment-data-changed";
const channelName = "workforce-payment-data";

let paymentChannel;

const getPaymentChannel = () => {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
    return null;
  }
  if (!paymentChannel) {
    paymentChannel = new BroadcastChannel(channelName);
    paymentChannel.addEventListener("message", (event) => {
      if (event.data?.type === paymentDataChangedEvent) {
        window.dispatchEvent(
          new CustomEvent(paymentDataChangedEvent, {
            detail: { source: "remote" },
          }),
        );
      }
    });
  }
  return paymentChannel;
};

export const notifyPaymentDataChanged = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(paymentDataChangedEvent, {
      detail: { source: "local" },
    }),
  );
  getPaymentChannel()?.postMessage({ type: paymentDataChangedEvent });
};

export const subscribeToPaymentChanges = (listener) => {
  if (typeof window === "undefined") return () => {};
  getPaymentChannel();
  const handleChange = (event) => {
    listener(event.detail?.source || "local");
  };
  window.addEventListener(paymentDataChangedEvent, handleChange);
  return () => window.removeEventListener(paymentDataChangedEvent, handleChange);
};
