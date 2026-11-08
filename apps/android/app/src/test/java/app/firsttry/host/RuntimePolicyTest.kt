package app.firsttry.host

import org.junit.Assert.*
import org.junit.Test

class RuntimePolicyTest {
    private val origin = "https://app-123.mini.firsttry.invalid"

    @Test
    fun onlyScopedHttpsIsAllowed() {
        assertTrue(RuntimePolicy.permits("$origin/index.html", origin))
        for (url in
            listOf(
                "http://app-123.mini.firsttry.invalid/index.html",
                "https://evil.example/index.html",
                "javascript:alert(1)",
                "file:///etc/passwd",
                "$origin/%2e%2e/secret",
                "$origin/index.html?token=x",
                "https://user@app-123.mini.firsttry.invalid/index.html",
            )) assertFalse(url, RuntimePolicy.permits(url, origin))
    }

    @Test
    fun pathsRejectTraversal() {
        assertTrue(RuntimePolicy.safePath("assets/main.js"))
        for (path in listOf("../escape.js", "/absolute.js", "a\\b.js", "a/../../b.js")) assertFalse(
            RuntimePolicy.safePath(path)
        )
    }

    @Test
    fun hashMatchesKnownVector() {
        assertEquals(
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            RuntimePolicy.hash(byteArrayOf()),
        )
    }
}
