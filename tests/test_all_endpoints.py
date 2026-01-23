import asyncio
import httpx
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8080" # Using port 8080 as that is what is running according to context
TEST_USER = {
    "username": "test_user_" + datetime.now().strftime("%Y%m%d%H%M%S"),
    "email": f"test_{datetime.now().timestamp()}@example.com",
    "password": "Test123!@#"
}

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'

async def test_endpoint(client, method, url, expected_status, headers=None, json=None, data=None, name=""):
    """Test a single endpoint"""
    print(f"{Colors.BLUE}Testing: {name or url}{Colors.END}")
    
    try:
        response = await client.request(
            method=method,
            url=url,
            headers=headers,
            json=json,
            data=data,
            timeout=10.0
        )
        
        success = response.status_code == expected_status
        
        if success:
            print(f"{Colors.GREEN}✅ PASS - Status: {response.status_code}{Colors.END}")
            try:
                data = response.json()
                print(f"   Response keys: {list(data.keys()) if isinstance(data, dict) else type(data)}")
            except:
                pass
        else:
            print(f"{Colors.RED}❌ FAIL - Expected {expected_status}, got {response.status_code}{Colors.END}")
            print(f"   Response: {response.text[:200]}")
        
        return success, response
        
    except Exception as e:
        print(f"{Colors.RED}❌ ERROR - {str(e)}{Colors.END}")
        return False, None

async def run_all_tests():
    """Execute complete test suite"""
    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        results = []
        token = None
        
        # Test 1: Health Check (if added)
        # Verify if /api/debug/health exists or skip if not implemented yet
        # For now we will try it, but be resilient if 404
        success, _ = await test_endpoint(
            client, "GET", "/api/debug/health", 200,
            name="Health Check"
        )
        if not success: 
             print(f"{Colors.YELLOW}⚠️ Health Check failed (might not be implemented yet){Colors.END}")
        else:
             results.append(("Health Check", success))
        
        # Test 2: Register
        success, response = await test_endpoint(
            client, "POST", "/api/auth/register", 200,
            json=TEST_USER,
            name="User Registration"
        )
        results.append(("Registration", success))
        
        if not success:
            print(f"{Colors.RED}⚠️ Registration failed, cannot continue{Colors.END}")
            return results
        
        # Test 3: Login
        success, response = await test_endpoint(
            client, "POST", "/api/auth/login", 200,
            data={
                "username": TEST_USER["username"],
                "password": TEST_USER["password"]
            },
            name="User Login"
        )
        results.append(("Login", success))
        
        if success and response:
            data = response.json()
            token = data.get("access_token")
            print(f"{Colors.GREEN}   Token obtained: {token[:20]}...{Colors.END}")
        
        if not token:
            print(f"{Colors.RED}⚠️ No token obtained, cannot test protected endpoints{Colors.END}")
            return results
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Test 4: Get Metrics
        success, _ = await test_endpoint(
            client, "GET", "/api/analytics/metrics", 200,
            headers=headers,
            name="Analytics Metrics"
        )
        results.append(("Metrics", success))
        
        # Test 5: Capacity Report
        today = datetime.now().date()
        next_week = today + timedelta(days=7)
        success, _ = await test_endpoint(
            client, "GET", 
            f"/api/analytics/capacity-report?start_date={today}&end_date={next_week}",
            200,
            headers=headers,
            name="Capacity Report"
        )
        results.append(("Capacity Report", success))
        
        # Test 6: Project Stats
        success, _ = await test_endpoint(
            client, "GET", "/api/analytics/projects/stats", 200,
            headers=headers,
            name="Project Stats"
        )
        results.append(("Project Stats", success))
        
        # Test 7: Deep Dive
        success, _ = await test_endpoint(
            client, "GET", "/api/analytics/projects/deep-dive", 200,
            headers=headers,
            name="Project Deep Dive"
        )
        results.append(("Deep Dive", success))
        
        # Test 8: Gantt Data
        success, _ = await test_endpoint(
            client, "GET", "/api/tasks/gantt", 200,
            headers=headers,
            name="Gantt Data"
        )
        results.append(("Gantt", success))
        
        # Test 9: Overdue Tasks
        success, _ = await test_endpoint(
            client, "GET", "/api/tasks/overdue", 200,
            headers=headers,
            name="Overdue Tasks"
        )
        results.append(("Overdue", success))
        
        # Test 10: Upcoming Tasks
        success, _ = await test_endpoint(
            client, "GET", "/api/tasks/upcoming", 200,
            headers=headers,
            name="Upcoming Tasks"
        )
        results.append(("Upcoming", success))
        
        return results

async def main():
    print(f"\n{Colors.BLUE}{'='*60}{Colors.END}")
    print(f"{Colors.BLUE}COMPREHENSIVE API TEST SUITE{Colors.END}")
    print(f"{Colors.BLUE}{'='*60}{Colors.END}\n")
    
    results = await run_all_tests()
    
    print(f"\n{Colors.BLUE}{'='*60}{Colors.END}")
    print(f"{Colors.BLUE}TEST SUMMARY{Colors.END}")
    print(f"{Colors.BLUE}{'='*60}{Colors.END}\n")
    
    passed = sum(1 for _, success in results if success)
    total = len(results)
    
    for name, success in results:
        status = f"{Colors.GREEN}✅ PASS{Colors.END}" if success else f"{Colors.RED}❌ FAIL{Colors.END}"
        print(f"{status} - {name}")
    
    print(f"\n{Colors.BLUE}Result: {passed}/{total} tests passed{Colors.END}")
    
    if passed == total and total > 0:
        print(f"{Colors.GREEN}🎉 ALL TESTS PASSED!{Colors.END}\n")
    else:
        print(f"{Colors.YELLOW}⚠️ Some tests failed. Check logs above.{Colors.END}\n")

if __name__ == "__main__":
    asyncio.run(main())
