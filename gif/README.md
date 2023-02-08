# GIF

The goal of this project was to understand how the GIF format is structured.

The [source code](gif.js) gets a GIF file, parse it, decompress each images and render it on a canvas element.

> **Warning**
>
> Please note this project is for educational purpose only.  
> The performances are **probably bad** and the feature set is **incomplete**.

Great ressources:

- [GIF Specification](https://www.w3.org/Graphics/GIF/spec-gif89a.txt)
- [GIF on Wikipedia](https://en.wikipedia.org/wiki/GIF)
- [LZW on Wikipedia](https://en.wikipedia.org/wiki/Lempel%E2%80%93Ziv%E2%80%93Welch)
- [Chromium source](https://chromium.googlesource.com/chromium/blink.git/+/master/Source/platform/image-decoders/gif/GIFImageReader.cpp)
- [What's in a GIF](http://www.matthewflickinger.com/lab/whatsinagif/)
