import app.main as main


def test_social_routes_are_registered():
    routes = {(route.path, method) for route in main.app.routes for method in getattr(route, "methods", set())}

    expected = {
        ("/users/search", "GET"),
        ("/friends/requests", "GET"),
        ("/friends/requests", "POST"),
        ("/friends/requests/incoming", "GET"),
        ("/friends/requests/{request_id}/accept", "POST"),
        ("/friends", "GET"),
        ("/conversations", "GET"),
        ("/conversations", "POST"),
        ("/conversations/{conversation_id}/messages", "GET"),
        ("/conversations/{conversation_id}/messages", "POST"),
        ("/game-invites", "GET"),
        ("/game-invites", "POST"),
        ("/notifications", "GET"),
        ("/notifications/{notification_id}/read", "POST"),
        ("/social/invite-link", "GET"),
    }

    assert expected <= routes


def test_collection_and_price_alert_routes_are_registered():
    routes = {(route.path, method) for route in main.app.routes for method in getattr(route, "methods", set())}

    expected = {
        ("/favorites", "GET"),
        ("/favorites", "POST"),
        ("/favorites/{catalog_game_id}", "DELETE"),
        ("/wishlist", "GET"),
        ("/wishlist", "POST"),
        ("/wishlist/{catalog_game_id}", "PATCH"),
        ("/wishlist/{catalog_game_id}", "DELETE"),
        ("/price-alerts", "GET"),
        ("/price-alerts", "POST"),
        ("/price-alerts/{alert_id}", "PATCH"),
        ("/price-alerts/{alert_id}", "DELETE"),
    }

    assert expected <= routes
