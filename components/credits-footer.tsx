export function CreditsFooter() {
  return (
    <div className="mt-auto">
      {/* Full-width divider with negative margins to counteract parent padding */}
      <div className="h-px bg-border -mx-4 mb-4" />
      <p className="text-sm text-white mt-0 py-2.5">
        Made by{" "}
        <a
          href="https://www.sebastiaosommer.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-dotted underline-offset-2 hover:opacity-80 transition-opacity"
        >
          Sebastião Sommer
        </a>
      </p>
    </div>
  )
}
