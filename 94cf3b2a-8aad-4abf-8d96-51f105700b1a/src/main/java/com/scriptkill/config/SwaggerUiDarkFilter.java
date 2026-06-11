package com.scriptkill.config;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpServletResponseWrapper;
import org.springframework.stereotype.Component;

import java.io.*;
import java.nio.charset.StandardCharsets;

@Component
public class SwaggerUiDarkFilter implements Filter {

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        HttpServletRequest httpRequest = (HttpServletRequest) request;
        String path = httpRequest.getRequestURI();

        if (path.contains("/swagger-ui/index.html") || path.equals("/swagger-ui.html")) {
            CharResponseWrapper wrappedResponse = new CharResponseWrapper((HttpServletResponse) response);
            chain.doFilter(request, wrappedResponse);

            String original = wrappedResponse.toString();
            String darkCssLink = "<link rel=\"stylesheet\" type=\"text/css\" href=\"/dark-theme.css\" />";
            String modified = original.replace("</head>", darkCssLink + "\n  </head>");

            byte[] bytes = modified.getBytes(StandardCharsets.UTF_8);
            response.setContentLength(bytes.length);
            response.getOutputStream().write(bytes);
        } else {
            chain.doFilter(request, response);
        }
    }

    private static class CharResponseWrapper extends HttpServletResponseWrapper {
        private final CharArrayWriter writer = new CharArrayWriter();

        public CharResponseWrapper(HttpServletResponse response) {
            super(response);
        }

        @Override
        public PrintWriter getWriter() {
            return new PrintWriter(writer);
        }

        @Override
        public ServletOutputStream getOutputStream() {
            return new ServletOutputStream() {
                @Override
                public boolean isReady() {
                    return true;
                }

                @Override
                public void setWriteListener(WriteListener writeListener) {
                }

                @Override
                public void write(int b) {
                    writer.write(b);
                }
            };
        }

        @Override
        public String toString() {
            return writer.toString();
        }
    }
}
