import ReceivedCommitQueue from "../src/received-commit-queue";

describe(ReceivedCommitQueue, () => {
  test("passes through ordered commits", () => {
    const receive = jest.fn();

    const queue = new ReceivedCommitQueue<{ v: number; ref: string }>(
      0,
      receive
    );

    const commits = [
      { v: 1, ref: "aaa" },
      { v: 2, ref: "bbb" },
      { v: 3, ref: "ccc" },
      { v: 4, ref: "ddd" },
    ];

    commits.forEach((commit, i) => {
      queue.receive(commit);
      expect(receive).toHaveBeenNthCalledWith(i + 1, commit);
    });
  });

  test("ignores old commits", () => {
    const receive = jest.fn();

    const queue = new ReceivedCommitQueue<{ v: number }>(5, receive);

    queue.receive({ v: 0 });
    queue.receive({ v: 5 });
    expect(receive).toHaveBeenCalledTimes(0);

    queue.receive({ v: 6 });
    expect(receive).toHaveBeenCalledTimes(1);
    expect(receive).toHaveBeenLastCalledWith({ v: 6 });
    queue.receive({ v: 6 });
    queue.receive({ v: 6 });

    queue.receive({ v: 7 });
    expect(receive).toHaveBeenCalledTimes(2);
    expect(receive).toHaveBeenLastCalledWith({ v: 7 });

    queue.receive({ v: 1 });
    queue.receive({ v: -1 });
    queue.receive({ v: 5 });
    queue.receive({ v: 6 });

    expect(receive).toHaveBeenCalledTimes(2);

    expect(queue["queue"]).toStrictEqual({});
  });

  test("reorders commits", () => {
    const receive = jest.fn();

    const queue = new ReceivedCommitQueue<{ v: number }>(5, receive);

    queue.receive({ v: 6 });
    expect(receive).toHaveBeenLastCalledWith({ v: 6 });

    queue.receive({ v: 8 });
    queue.receive({ v: 9 });
    queue.receive({ v: 11 });
    expect(receive).toHaveBeenLastCalledWith({ v: 6 });
    expect(queue["queue"]).toStrictEqual({
      8: { v: 8 },
      9: { v: 9 },
      11: { v: 11 },
    });

    queue.receive({ v: 7 });
    expect(receive).toHaveBeenNthCalledWith(2, { v: 7 });
    expect(receive).toHaveBeenNthCalledWith(3, { v: 8 });
    expect(receive).toHaveBeenNthCalledWith(4, { v: 9 });
    queue.receive({ v: 8 });
    expect(receive).toHaveBeenCalledTimes(4);
    expect(queue["queue"]).toStrictEqual({ 11: { v: 11 } });

    queue.receive({ v: 10 });
    expect(receive).toHaveBeenNthCalledWith(5, { v: 10 });
    expect(receive).toHaveBeenNthCalledWith(6, { v: 11 });
    queue.receive({ v: 12 });
    expect(receive).toHaveBeenNthCalledWith(7, { v: 12 });
    expect(receive).toHaveBeenCalledTimes(7);

    expect(queue["queue"]).toStrictEqual({});
  });
});
