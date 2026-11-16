// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import { Test, console } from "forge-std/Test.sol";
import { NavBook } from "../contracts/NavBook.sol";

/**
 * @title NavBookTest
 * @dev Comprehensive test suite for NavBook contract covering:
 * - Owner can post marks
 * - Non-owner cannot post marks
 * - Zero NAV reverts
 * - Impossible date reverts
 * - Fresh marks (today, 3 days old)
 * - Stale marks (4 days old)
 * - Tradable NAV calculation skips stale IDs
 * 
 * Note: This test file is written for Foundry (forge test). 
 * For Hardhat, see test/NavBook.ts for TypeScript tests.
 */
contract NavBookTest is Test {
    NavBook navBook;
    address owner;
    address nonOwner;
    bytes32 constant ASSET_A = 0x0000000000000000000000000000000000000000000000000000000000000001;
    bytes32 constant ASSET_B = 0x0000000000000000000000000000000000000000000000000000000000000002;
    bytes32 constant ASSET_C = 0x0000000000000000000000000000000000000000000000000000000000000003;
    bytes32 constant ASSET_D = 0x0000000000000000000000000000000000000000000000000000000000000004;
    bytes32 constant UNKNOWN_ASSET = 0x0000000000000000000000000000000000000000000000000000000000000099;

    // Using a fixed "today" for deterministic tests: 2026-11-09 = 20261109
    uint32 constant TODAY = 20261109;

    function setUp() public {
        owner = address(0x1234);
        nonOwner = address(0x5678);
        vm.prank(owner);
        navBook = new NavBook();
    }

    // ============================================================
    // POST MARK TESTS
    // ============================================================

    function test_OwnerCanPostMark() public {
        vm.prank(owner);
        navBook.postMark(ASSET_A, 1_000_00, 20261109); // $1,000.00, today

        (uint256 navUsd, uint32 markDate) = navBook.marks(ASSET_A);
        assertEq(navUsd, 1_000_00);
        assertEq(markDate, 20261109);
    }

    function test_NonOwnerCannotPostMark() public {
        vm.prank(nonOwner);
        vm.expectRevert(NavBook.NotOwner.selector);
        navBook.postMark(ASSET_A, 1_000_00, 20261109);
    }

    function test_ZeroNavReverts() public {
        vm.prank(owner);
        vm.expectRevert(NavBook.ZeroNav.selector);
        navBook.postMark(ASSET_A, 0, 20261109);
    }

    function test_ImpossibleDateFutureReverts() public {
        vm.prank(owner);
        vm.expectRevert(NavBook.ImpossibleDate.selector);
        navBook.postMark(ASSET_A, 1_000_00, 20991231); // Far future
    }

    function test_ImpossibleDateInvalidFormatReverts() public {
        vm.prank(owner);
        vm.expectRevert(NavBook.ImpossibleDate.selector);
        navBook.postMark(ASSET_A, 1_000_00, 20261301); // Invalid month

        vm.prank(owner);
        vm.expectRevert(NavBook.ImpossibleDate.selector);
        navBook.postMark(ASSET_A, 1_000_00, 20261100); // Invalid day (0)

        vm.prank(owner);
        vm.expectRevert(NavBook.ImpossibleDate.selector);
        navBook.postMark(ASSET_A, 1_000_00, 20261132); // Invalid day (32)

        vm.prank(owner);
        vm.expectRevert(NavBook.ImpossibleDate.selector);
        navBook.postMark(ASSET_A, 1_000_00, 19991231); // Year too early
    }

    // ============================================================
    // IS STALE TESTS
    // ============================================================

    function test_MissingMarkIsStale() public {
        assertTrue(navBook.isStale(UNKNOWN_ASSET, TODAY));
    }

    function test_MarkDatedTodayIsFresh() public {
        vm.prank(owner);
        navBook.postMark(ASSET_A, 1_000_00, TODAY);
        assertFalse(navBook.isStale(ASSET_A, TODAY));
    }

    function test_Mark3DaysOldIsFresh() public {
        vm.prank(owner);
        navBook.postMark(ASSET_B, 2_000_00, 20261106); // 3 days ago
        assertFalse(navBook.isStale(ASSET_B, TODAY));
    }

    function test_Mark4DaysOldIsStale() public {
        vm.prank(owner);
        navBook.postMark(ASSET_C, 3_000_00, 20261105); // 4 days ago
        assertTrue(navBook.isStale(ASSET_C, TODAY));
    }

    // ============================================================
    // TRADABLE NAV TESTS
    // ============================================================

    function test_TradableNavEmptyListReturnsZero() public {
        bytes32[] memory empty = new bytes32[](0);
        assertEq(navBook.tradableNav(empty, TODAY), 0);
    }

    function test_TradableNavSumsFreshMarks() public {
        vm.prank(owner);
        navBook.postMark(ASSET_A, 1_000_00, TODAY);
        vm.prank(owner);
        navBook.postMark(ASSET_B, 2_000_00, 20261106);

        bytes32[] memory assets = new bytes32[](2);
        assets[0] = ASSET_A;
        assets[1] = ASSET_B;

        assertEq(navBook.tradableNav(assets, TODAY), 3_000_00);
    }

    function test_TradableNavSkipsStaleMark() public {
        vm.prank(owner);
        navBook.postMark(ASSET_A, 1_000_00, TODAY);
        vm.prank(owner);
        navBook.postMark(ASSET_C, 5_000_00, 20261105); // Stale

        bytes32[] memory assets = new bytes32[](2);
        assets[0] = ASSET_A;
        assets[1] = ASSET_C;

        assertEq(navBook.tradableNav(assets, TODAY), 1_000_00);
    }

    function test_TradableNavSkipsUnknownAsset() public {
        vm.prank(owner);
        navBook.postMark(ASSET_A, 1_000_00, TODAY);

        bytes32[] memory assets = new bytes32[](2);
        assets[0] = ASSET_A;
        assets[1] = UNKNOWN_ASSET;

        assertEq(navBook.tradableNav(assets, TODAY), 1_000_00);
    }

    function test_TradableNavSkipsStaleAndUnknown() public {
        vm.prank(owner);
        navBook.postMark(ASSET_A, 1_000_00, TODAY);
        vm.prank(owner);
        navBook.postMark(ASSET_C, 5_000_00, 20261105);

        bytes32[] memory assets = new bytes32[](3);
        assets[0] = ASSET_A;
        assets[1] = ASSET_C;
        assets[2] = UNKNOWN_ASSET;

        assertEq(navBook.tradableNav(assets, TODAY), 1_000_00);
    }

    // ============================================================
    // EDGE CASE TESTS
    // ============================================================

    function test_MultipleMarksForSameAssetOverwrites() public {
        vm.prank(owner);
        navBook.postMark(ASSET_A, 1_000_00, 20261106);

        vm.prank(owner);
        navBook.postMark(ASSET_A, 2_000_00, TODAY);

        assertFalse(navBook.isStale(ASSET_A, TODAY));
        (uint256 navUsd, ) = navBook.marks(ASSET_A);
        assertEq(navUsd, 2_000_00);
    }

    function test_TradableNavWithMultipleAssetsMixed() public {
        vm.prank(owner);
        navBook.postMark(ASSET_A, 1_000_00, TODAY);
        vm.prank(owner);
        navBook.postMark(ASSET_B, 2_000_00, 20261107);
        vm.prank(owner);
        navBook.postMark(ASSET_C, 3_000_00, 20261108);
        vm.prank(owner);
        navBook.postMark(ASSET_D, 4_000_00, 20261105);

        bytes32[] memory assets = new bytes32[](5);
        assets[0] = ASSET_A;
        assets[1] = ASSET_B;
        assets[2] = ASSET_C;
        assets[3] = ASSET_D;
        assets[4] = UNKNOWN_ASSET;

        assertEq(navBook.tradableNav(assets, TODAY), 6_000_00);
    }

    // ============================================================
    // EVENT TESTS
    // ============================================================

    function test_MarkPostedEventEmitted() public {
        vm.prank(owner);
        vm.expectEmit(true, true, false, true);
        emit NavBook.MarkPosted(ASSET_A, 1_000_00, TODAY);
        navBook.postMark(ASSET_A, 1_000_00, TODAY);
    }
}