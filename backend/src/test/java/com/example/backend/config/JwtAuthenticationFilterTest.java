package com.example.backend.config;

import com.example.backend.models.Role;
import com.example.backend.models.User;
import com.example.backend.repositories.UserRepository;
import com.example.backend.services.JwtService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class JwtAuthenticationFilterTest {

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void preservesRolesThatAlreadyHaveTheSpringPrefix() {
        assertEquals("ROLE_USER", JwtAuthenticationFilter.normalizeAuthority(Role.ROLE_USER));
        assertEquals("ROLE_ADMIN", JwtAuthenticationFilter.normalizeAuthority(Role.ROLE_ADMIN));
        assertEquals("ROLE_MANAGER", JwtAuthenticationFilter.normalizeAuthority(Role.ROLE_MANAGER));
    }

    @Test
    void prefixesRolesWithoutTheSpringPrefix() {
        assertEquals("ROLE_ARTIST", JwtAuthenticationFilter.normalizeAuthority(Role.ARTIST));
        assertEquals("ROLE_COMPANY", JwtAuthenticationFilter.normalizeAuthority(Role.COMPANY));
    }

    @Test
    void nullRoleFailsClosedAndClearsAuthentication() throws Exception {
        JwtService jwtService = mock(JwtService.class);
        UserRepository userRepository = mock(UserRepository.class);
        User user = new User();
        user.setEmail("user@example.test");
        user.setRole(null);

        when(jwtService.isValid("valid-token")).thenReturn(true);
        when(jwtService.extractSubject("valid-token")).thenReturn("user@example.test");
        when(userRepository.findByEmail("user@example.test")).thenReturn(Optional.of(user));

        JwtAuthenticationFilter filter = new JwtAuthenticationFilter(jwtService, userRepository);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(
                        "previous", null, List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))));
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer valid-token");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilterInternal(request, response, (servletRequest, servletResponse) -> { });

        assertNull(SecurityContextHolder.getContext().getAuthentication());
    }
}
