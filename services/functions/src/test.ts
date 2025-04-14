type Event = {
  shouldError: boolean;
};

export function main(e: Event) {
  if (e.shouldError) {
    throw new Error("This function threw an error");
  }

  return {
    ok: true,
  };
}
