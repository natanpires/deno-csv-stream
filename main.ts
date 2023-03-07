import { readableStreamFromReader } from "https://deno.land/std@0.140.0/streams/conversion.ts";

const REGEX_ESCAPE = /(\r\n|\n|\r|\")/gm;

const csvToJSON = () => {
  let columns: string[] = [];

  const getHeader = (str: string): string[] => {
    const cleaned = str.replace(REGEX_ESCAPE, "");
    if (cleaned[cleaned.length - 1] == ",") {
      return cleaned.substring(0, cleaned.length - 1).split(",");
    }
    return cleaned.split(",");
  };

  return new TransformStream({
    transform(chunk, controller) {
      const lines = chunk.split("\n");

      if (!columns.length) {
        columns = lines[1] !== "\r"
          ? getHeader(lines.shift())
          : getHeader(lines[lines.lastIndexOf("\r") + 1]);
      }

      for (const line of lines) {
        if (!line.length) continue;

        const currentColumns = line.trimEnd().split(",");
        const currentItem: Record<string, unknown> = {};
        for (const columIndex in currentColumns) {
          const columnItem = currentColumns?.[columIndex];
          if (!!columnItem) {
            currentItem[columns[columIndex]] = columnItem.replace(
              REGEX_ESCAPE,
              "",
            );
          }
        }

        controller.enqueue(currentItem);
      }
    },
  });
};

// HttpServer

const server = Deno.listen({ port: 8080 });
console.log("File server running on http://localhost:8080/");

for await (const conn of server) {
  handleHttp(conn).catch(console.error);
}

async function handleHttp(conn: Deno.Conn) {
  const httpConn = Deno.serveHttp(conn);
  for await (const requestEvent of httpConn) {
    // Use the request pathname as filepath
    const url = new URL(requestEvent.request.url);
    const filepath = decodeURIComponent(url.pathname);

    // Try opening the file
    let file;
    try {
        const file = await Deno.readFile(
            "./PI_NY.GDP.MKTP.CD_DS2_en_csv_v2_4901850.csv",
        );

        const stream: ReadableStream = readableStreamFromReader(
            file,
            { read: true }
        );

        stream.pipeThrough(new TextDecoderStream())
            .pipeThrough(csvToJSON())
            .pipeTo(
                new WritableStream({
                    write: (data) => {
                    console.log(data);
                    },
                    close: () => {},
                }),
            );
    } catch {
      // If the file cannot be opened, return a "404 Not Found" response
      const notFoundResponse = new Response("404 Not Found", { status: 404 });
      await requestEvent.respondWith(notFoundResponse);
      continue;
    }

        // Build a readable stream so the file doesn't have to be fully loaded into
    // memory while we send it
    const readableStream = file.readable;

    // Build and send the response
    const response = new Response(readableStream);
    await requestEvent.respondWith(response);
  }
}
