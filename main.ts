import { serve } from "https://deno.land/std@0.140.0/http/server.ts";
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
async function handler(_req) {
    // Try opening the file
    try {
      const file = await Deno.open(
          "./API_NY.GDP.MKTP.CD_DS2_en_csv_v2_4901850.csv",
        { read: true }
      );

      const fsStream: ReadableStream = readableStreamFromReader(file);

      fsStream.pipeThrough(new TextDecoderStream())
          .pipeThrough(csvToJSON())
          .pipeTo(
              new WritableStream({
                  write: (data) => {
                  console.log(data);
                  },
                  close: () => {},
              }),
          );
      
      // Build and send the response
      return new Response(fsStream);
    } catch {
      // If the file cannot be opened, return a "404 Not Found" response
      return new Response("404 Not Found", { status: 404 });
    }
}

serve(handler);
