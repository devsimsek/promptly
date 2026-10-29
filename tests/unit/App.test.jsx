// Component tests: App mounts, renders edit mode, and survives storage.

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "../../src/App.jsx";

beforeEach(async () => {
  localStorage.clear();
  // Fresh object-store per test; avoids deleteDatabase-vs-open races.
  const { IDBFactory } = await import("fake-indexeddb");
  globalThis.indexedDB = new IDBFactory();
});

describe("App shell", () => {
  it("renders edit mode with library and editor", async () => {
    render(
      <StrictMode>
        <App />
      </StrictMode>
    );
    await waitFor(() => expect(screen.getByLabelText("Script library")).toBeTruthy());
    expect(screen.getByLabelText("Script text")).toBeTruthy();
    expect(screen.getByText("Speech tracking")).toBeTruthy();
  });

  it("creates a first untitled script on fresh storage", async () => {
    render(<App />);
    await waitFor(() => {
      const input = screen.getByPlaceholderText("Script title");
      expect(input.value).toBe("Untitled");
    });
  });

  it("keeps prompter entry disabled until words exist", async () => {
    render(<App />);
    const prompterButton = await screen.findByRole("button", { name: /prompter/i });
    await waitFor(() => expect(prompterButton.disabled).toBe(true));
  });

  it("moves to prompter mode after typing words", async () => {
    render(<App />);
    const textarea = await screen.findByLabelText("Script text");
    await waitFor(() => expect(textarea.disabled).toBe(false));
    fireEvent.change(textarea, { target: { value: "First words for the prompter" } });
    const prompterButton = screen.getByRole("button", { name: /^Prompter$/i });
    await waitFor(() => expect(prompterButton.disabled).toBe(false));
    fireEvent.click(prompterButton);
    expect(screen.getByTestId("prompter")).toBeTruthy();
    expect(screen.getByText("Edit")).toBeTruthy();
  });
});
