import { serve } from 'https://deno.land/std@0.140.0/http/server.ts';

const REGEX_ESCAPE = /(\r\n|\n|\r|\")/gm;

const csvToJSON = () => {
  let columns: string[] = [];

  const getHeader = (str: string): string[] => {
    const cleaned = str.replace(REGEX_ESCAPE, '');
    if (cleaned[cleaned.length - 1] == ',') {
      return cleaned.substring(0, cleaned.length - 1).split(',');
    }
    return cleaned.split(',');
  };

  return new TransformStream({
    transform(chunk, controller) {
      const lines = chunk.split('\n');
      let firstLineIdx = 0;

      if (!columns.length) {
        if (lines[1] !== '\r') {
          columns = getHeader(lines.shift());
        } else {
          firstLineIdx = lines.lastIndexOf('\r') + 1;
          columns = getHeader(lines[firstLineIdx]);
        }
      }

      for (const line of lines.slice(firstLineIdx + 1)) {
        if (!line.length) continue;

        const currentColumns = line.trimEnd().split(',');
        const currentItem: Record<string, unknown> = {};
        for (const columIndex in currentColumns) {
          const columnItem = currentColumns?.[columIndex];
          if (!!columnItem && columIndex) {
            currentItem[columns[columIndex]] = columnItem.replace(
              REGEX_ESCAPE,
              ''
            );
          }
        }

        controller.enqueue(currentItem);
      }
    },
  });
};

// HttpServer
async function handler(req) {
  // Try opening the file
  let data: Record<string, unknown>[] = [];
  let finished = false;
  try {
    const response = await fetch(
      req.url.replace(new URL(req.url).origin + '/', '')
    );

    const body = await response.body
      ?.pipeThrough(new TextDecoderStream())
      .pipeThrough(csvToJSON())
      .pipeTo(
        new WritableStream({
          write: (chunk) => {
            if (Object.keys(chunk).length) data.push(chunk);
          },
          close: () => {
            finished = true;
          },
        })
      );

    while (!finished) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return new Response(JSON.stringify(data));
  } catch (error) {
    // If the file cannot be opened, return a "404 Not Found" response
    if (error instanceof Deno.errors.NotFound)
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Unable to open the requested file',
        }),
        { status: 404 }
      );

    console.log(error);

    // Return a "422 Unprocessable Entity" response
    return new Response('Unable to process the request', { status: 422 });
  }
}

serve(handler);
